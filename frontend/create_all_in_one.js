import * as XLSX from 'xlsx';
import * as path from 'path';

const allInOneData = [
  {
    "Prompt": "A beautiful sunset over the Himalayan mountains",
    "Type": "image",
    "Size": "1:1",
    "Variations": 1,
    "Duration": "",
    "Reference 1": "",
    "Reference 2": "",
    "Reference 3": ""
  },
  {
    "Prompt": "A slow camera pan across the Himalayan mountains at sunset",
    "Type": "video",
    "Size": "16:9",
    "Variations": 1,
    "Duration": 8,
    "Reference 1": "@1",
    "Reference 2": "",
    "Reference 3": ""
  },
  {
    "Prompt": "An elegant sports car drifting on a wet neon street at night",
    "Type": "video",
    "Size": "landscape",
    "Variations": 1,
    "Duration": 8,
    "Reference 1": "",
    "Reference 2": "",
    "Reference 3": ""
  }
];

function generateAllInOne() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(allInOneData);
  XLSX.utils.book_append_sheet(wb, ws, "All-in-One Testing");
  
  const destPath = path.resolve('../all_in_one_test_template.xlsx');
  XLSX.writeFile(wb, destPath);
  console.log(`Successfully generated all-in-one test template at: ${destPath}`);
}

generateAllInOne();
