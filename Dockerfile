# --- Tahap 1: Basis Server ---
# Gunakan image Nginx resmi yang sangat ringan (berbasis Alpine Linux)
FROM nginx:1.27-alpine

# --- Tahap 2: Salin File ---
# Salin semua file statis (HTML, CSS, JS) ke direktori web root default Nginx
COPY *.html /usr/share/nginx/html/
COPY *.css /usr/share/nginx/html/
COPY *.js /usr/share/nginx/html/

# --- Tahap 3: Ekspos Port ---
# Beri tahu Docker bahwa container ini akan mendengarkan di port 80 (HTTP default)
EXPOSE 80

# --- Tahap 4: Perintah Jalan ---
# Perintah default untuk Nginx sudah ada di base image,
# yaitu `nginx -g 'daemon off;'` sehingga kita tidak perlu menambahkannya.