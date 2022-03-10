##
# [container] builder
##
FROM node:14-alpine AS builder

WORKDIR /builder

# Install node dependencies - done in a separate step so Docker can cache it.
COPY package*.json yarn.lock ./
RUN yarn install

COPY . ./

RUN yarn build

##
# [container] Production
##
FROM node:14-alpine AS base

WORKDIR /home/node/app

COPY --from=builder /builder/node_modules ./node_modules
COPY --from=builder /builder/package*.json ./
COPY --from=builder /builder/yarn.lock ./
COPY --from=builder /builder/dist ./dist

##
# [container] Production
##
FROM base AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

