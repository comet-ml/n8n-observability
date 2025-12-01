FROM n8nio/n8n:latest

USER root
RUN npm install -g n8n-observability

ENV EXTERNAL_HOOK_FILES=/usr/local/lib/node_modules/n8n-observability/dist/hooks.cjs

USER node
