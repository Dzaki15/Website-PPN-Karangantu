This folder should contain the production builds of PDF.js so the app can render PDFs offline.

How to populate:

1. Download the official builds from Mozilla's pdf.js releases. For example, from the pdf.js GitHub releases:
   - https://github.com/mozilla/pdf.js/releases

2. From a release (for example `v2.16.105`) download the following files and place them here:
   - `pdf.min.js` (copy from `build/pdf.min.js`)
   - `pdf.worker.min.js` (copy from `build/pdf.worker.min.js`)

Put those two files in this directory so the preview page can use them locally.

Quick PowerShell one-liners (requires internet):

```powershell
cd assets/pdfjs
Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js" -OutFile pdf.min.js
Invoke-WebRequest -Uri "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js" -OutFile pdf.worker.min.js
```

If you cannot download, the preview will fall back to the CDN automatically.

Notes:
- PDF.js releases change; adapt the version in the URLs above if you want a different version.
- For offline or restricted environments, keep these files committed to the repo.
