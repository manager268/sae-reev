# REEV SAEINDIA 4.0

Website for the SAEINDIA Bengaluru Section's REEV (Range Extended Electric Vehicle) competition.

## Structure

```
index.html          Main page
css/style.css        Styles
js/main.js            Countdown timer, mobile nav, hero slideshow, gallery lightbox
assets/images/        Web-optimized images used by the site
assets/                Original source photos and logo
```

## Running locally

Serving over HTTP is required so relative asset paths resolve correctly.

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/index.html`.
