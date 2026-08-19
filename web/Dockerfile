FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

FROM builder AS dev

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

ARG VITE_API_BASE_URL=http://localhost:3001/api/v1
ARG VITE_WS_BASE_URL=ws://localhost:3001
ARG VITE_DEV_TOKEN=
ARG VITE_DEV_TENANT_ID=1
ARG VITE_DEV_TENANT_NAME=Demo Tenant
ARG VITE_SPEED_TEST_PING_URL=
ARG VITE_SPEED_TEST_UPLOAD_URL=
ARG VITE_REQUIRE_CAMERA=false

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_WS_BASE_URL=$VITE_WS_BASE_URL \
    VITE_DEV_TOKEN=$VITE_DEV_TOKEN \
    VITE_DEV_TENANT_ID=$VITE_DEV_TENANT_ID \
    VITE_DEV_TENANT_NAME=$VITE_DEV_TENANT_NAME \
    VITE_SPEED_TEST_PING_URL=$VITE_SPEED_TEST_PING_URL \
    VITE_SPEED_TEST_UPLOAD_URL=$VITE_SPEED_TEST_UPLOAD_URL \
    VITE_REQUIRE_CAMERA=$VITE_REQUIRE_CAMERA

RUN npm run build

FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
