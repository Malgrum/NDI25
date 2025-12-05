FROM node:18-alpine

WORKDIR /usr/src/app

# copy package.json first to leverage caching
COPY package*.json ./
RUN npm ci --only=production

# copy source
COPY . .

ENV PORT=3001
EXPOSE 3001

CMD ["npm", "start"]
