##
# [container] deps
##
FROM node:14-alpine AS deps

WORKDIR /deps

# Install node dependencies - done in a separate step so Docker can cache it.
COPY package*.json yarn.lock ./
RUN yarn install

##
# [container] Production
##
FROM node:14-alpine AS base

WORKDIR /home/node/app

COPY --from=deps /deps/node_modules ./node_modules

COPY . ./

RUN yarn build

##
# [container] Production
##
FROM base AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

