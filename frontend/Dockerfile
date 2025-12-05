FROM node:18-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm ci

# copy source and build
COPY . .
RUN npm run build

FROM nginx:stable-alpine
COPY --from=build /app/dist /usr/share/nginx/html

# Use a simple nginx config to support SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
