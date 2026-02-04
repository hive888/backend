FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 4001

# choose ONE that matches your project
# If you have "start" in package.json:
CMD ["npm","start"]

# OR if your real entry is app.js:
# CMD ["node","app.js"]

# OR if your entry is index.js:
# CMD ["node","index.js"]
