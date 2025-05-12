FROM nginx:alpine

COPY ./index.html /usr/share/nginx/html/
COPY ./LoginESP.js /usr/share/nginx/html/
COPY ./ncalayer-client.js /usr/share/nginx/html/
