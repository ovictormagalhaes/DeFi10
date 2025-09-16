// Simple Express static server for production builds
// Supports Render / typical PaaS (PORT env) and local fallback (5173)

const express = require('express');
const path = require('path');

const app = express();
const distPath = path.join(__dirname, 'dist');

// Basic security / caching headers (customize as needed)
app.use((req, res, next) => {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.static(distPath, {
  setHeaders: (res, filePath) => {
    if (/(sw|service-worker)\.js$/.test(filePath)) {
      // Ensure service workers aren't aggressively cached
      res.setHeader('Cache-Control', 'no-cache');
    }
  }
}));

// SPA fallback - send index.html for any non-file route
app.get('*', (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

const port = process.env.PORT || 5173; // Render provides PORT, local fallback 5173
app.listen(port, () => {
  console.log(`Defi10 static server running on port ${port}`);
});
