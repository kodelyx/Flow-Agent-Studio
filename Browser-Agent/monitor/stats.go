package main

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"time"
)

type memInfo struct {
	usedGB  float64
	totalGB float64
	pct     float64
}

func readMeminfo() memInfo {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return memInfo{}
	}
	defer f.Close()
	var totalKB, availKB float64
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) < 2 {
			continue
		}
		v, _ := strconv.ParseFloat(fields[1], 64)
		switch fields[0] {
		case "MemTotal:":
			totalKB = v
		case "MemAvailable:":
			availKB = v
		}
	}
	if totalKB == 0 {
		return memInfo{}
	}
	usedKB := totalKB - availKB
	return memInfo{
		usedGB:  round1(usedKB / 1024 / 1024),
		totalGB: round1(totalKB / 1024 / 1024),
		pct:     round1(usedKB / totalKB * 100),
	}
}

func round1(f float64) float64 {
	return float64(int(f*10+0.5)) / 10
}

// readCPUPercent samples /proc/stat over a short window.
func readCPUPercent() float64 {
	idle1, total1 := cpuSample()
	time.Sleep(200 * time.Millisecond)
	idle2, total2 := cpuSample()
	dt := total2 - total1
	if dt == 0 {
		return 0
	}
	return round1((1 - (idle2-idle1)/dt) * 100)
}

func cpuSample() (idle, total float64) {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return 0, 0
	}
	defer f.Close()
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		fields := strings.Fields(sc.Text())
		if len(fields) > 0 && fields[0] == "cpu" {
			for i, v := range fields[1:] {
				n, _ := strconv.ParseFloat(v, 64)
				total += n
				if i == 3 { // idle
					idle = n
				}
			}
			return idle, total
		}
	}
	return 0, 0
}

func readUptime() int {
	b, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(b))
	if len(fields) == 0 {
		return 0
	}
	v, _ := strconv.ParseFloat(fields[0], 64)
	return int(v)
}
