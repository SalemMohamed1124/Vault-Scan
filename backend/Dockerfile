FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

# Install Python, Redis, nmap, Chromium (for PDF reports), and required tools
RUN apk add --no-cache python3 py3-pip nmap curl redis chromium
RUN pip3 install --break-system-packages requests python-nmap beautifulsoup4 urllib3 dnspython
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json .
COPY --from=builder /app/scripts ./scripts
RUN mkdir -p tmp/reports

# Start script: Redis + Node
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 3001
ENV NODE_ENV=production
CMD ["./start.sh"]
