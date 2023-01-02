FROM node:18.12-slim

WORKDIR /app

COPY package.json package-lock*.json ./

RUN npm install && npm cache clean --force

COPY . .

ENV PORT 3000

EXPOSE 3000

CMD [ "npm", "start" ]