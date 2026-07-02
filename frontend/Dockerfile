# ---------------------------------------------------------------------------
# build: compile the React app with Vite (unchanged app code, unchanged
# build). VITE_API_BASE_URL is inlined into the static JS at build time -
# set it to whatever URL/IP the panel will actually be reached at (see
# docker-compose.yml / root .env.example).
# ---------------------------------------------------------------------------
FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts tailwind.config.js postcss.config.js index.html ./
COPY src ./src

ARG VITE_API_BASE_URL=http://localhost
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# ---------------------------------------------------------------------------
# runtime: nginx serving the static build and reverse-proxying the backend.
# ---------------------------------------------------------------------------
FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
