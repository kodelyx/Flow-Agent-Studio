// profilesync persists the Chrome user-data profile across Hugging Face Space
// restarts/rebuilds by snapshotting it into a Postgres (Neon) bytea blob.
//
//	profilesync restore  — pull the latest snapshot and extract it (run at boot)
//	profilesync backup   — tar+gzip the profile and upsert it (run on shutdown / periodically)
//
// The connection string comes from the DATABASE_URL env var (a Space secret) — it
// is never hardcoded. Cache/junk directories are excluded so the blob stays small
// enough for Neon's free tier; only login state (cookies, Local Storage, IndexedDB,
// Login Data, …) is kept.
package main

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"errors"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

const (
	profileDir = "/home/chrome/data" // Chrome --user-data-dir
	baseName   = "data"              // archive top-level dir
)

func main() {
	log.SetFlags(0)
	log.SetPrefix("[profilesync] ")

	if len(os.Args) < 2 {
		log.Fatal("usage: profilesync [backup|restore]")
	}
	mode := os.Args[1]

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		log.Println("DATABASE_URL not set — skipping")
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		log.Fatalf("connect: %v", err)
	}
	defer conn.Close(ctx)

	if _, err := conn.Exec(ctx, `CREATE TABLE IF NOT EXISTS chrome_profile (
		id         int PRIMARY KEY DEFAULT 1,
		updated_at timestamptz DEFAULT now(),
		data       bytea
	)`); err != nil {
		log.Fatalf("create table: %v", err)
	}

	switch mode {
	case "backup":
		if err := backup(ctx, conn); err != nil {
			log.Fatalf("backup: %v", err)
		}
	case "restore":
		if err := restore(ctx, conn); err != nil {
			log.Fatalf("restore: %v", err)
		}
	default:
		log.Fatalf("unknown mode %q (want backup|restore)", mode)
	}
}

// skipSegment reports whether a path segment is cache/junk we never persist.
func skipSegment(name string) bool {
	if strings.Contains(name, "Cache") || strings.HasPrefix(name, "Singleton") {
		return true
	}
	switch name {
	case "Crashpad", "component_crx_cache", "optimization_guide_model_store",
		"GraphiteDawnCache", "BrowserMetrics", "Safe Browsing", "LOCK", "LOG.old":
		return true
	}
	return false
}

func backup(ctx context.Context, conn *pgx.Conn) error {
	if _, err := os.Stat(profileDir); err != nil {
		log.Printf("profile dir %s missing — nothing to back up", profileDir)
		return nil
	}

	var buf bytes.Buffer
	gz := gzip.NewWriter(&buf)
	tw := tar.NewWriter(gz)

	walkErr := filepath.Walk(profileDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip unreadable entries
		}
		rel, err := filepath.Rel(profileDir, path)
		if err != nil || rel == "." {
			return nil
		}
		for _, seg := range strings.Split(rel, string(os.PathSeparator)) {
			if skipSegment(seg) {
				if info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
		}
		if !info.IsDir() && !info.Mode().IsRegular() {
			return nil // skip sockets/symlinks/etc.
		}
		hdr, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return nil
		}
		hdr.Name = filepath.ToSlash(filepath.Join(baseName, rel))
		if info.IsDir() {
			hdr.Name += "/"
		}
		if err := tw.WriteHeader(hdr); err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		f, err := os.Open(path)
		if err != nil {
			return nil // file vanished or locked — skip it
		}
		defer f.Close()
		io.Copy(tw, f)
		return nil
	})
	if walkErr != nil {
		return walkErr
	}
	if err := tw.Close(); err != nil {
		return err
	}
	if err := gz.Close(); err != nil {
		return err
	}

	if _, err := conn.Exec(ctx,
		`INSERT INTO chrome_profile (id, data, updated_at) VALUES (1, $1, now())
		 ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
		buf.Bytes()); err != nil {
		return err
	}
	log.Printf("backed up %d KB (compressed) to Postgres", buf.Len()/1024)
	return nil
}

func restore(ctx context.Context, conn *pgx.Conn) error {
	var data []byte
	err := conn.QueryRow(ctx, `SELECT data FROM chrome_profile WHERE id = 1`).Scan(&data)
	if errors.Is(err, pgx.ErrNoRows) {
		log.Println("no snapshot yet — fresh start")
		return nil
	}
	if err != nil {
		return err
	}
	if len(data) == 0 {
		log.Println("empty snapshot — fresh start")
		return nil
	}

	gz, err := gzip.NewReader(bytes.NewReader(data))
	if err != nil {
		return err
	}
	defer gz.Close()
	tr := tar.NewReader(gz)

	root := filepath.Dir(profileDir) // /home/chrome ; "data/..." lands at /home/chrome/data/...
	cleanRoot := filepath.Clean(root)
	var n int
	for {
		hdr, err := tr.Next()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return err
		}
		target := filepath.Join(root, filepath.Clean(hdr.Name))
		if target != cleanRoot && !strings.HasPrefix(target, cleanRoot+string(os.PathSeparator)) {
			continue // guard against path traversal
		}
		switch hdr.Typeflag {
		case tar.TypeDir:
			os.MkdirAll(target, 0o755)
		case tar.TypeReg:
			os.MkdirAll(filepath.Dir(target), 0o755)
			f, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, os.FileMode(hdr.Mode)&0o777)
			if err != nil {
				return err
			}
			if _, err := io.Copy(f, tr); err != nil {
				f.Close()
				return err
			}
			f.Close()
			n++
		}
	}
	log.Printf("restored %d files from Postgres snapshot", n)
	return nil
}
