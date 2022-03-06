##
# [container] Base
##
FROM node:14-alpine AS base

WORKDIR /home/node/app

# Install node dependencies - done in a separate step so Docker can cache it.
COPY package*.json yarn.lock ./
RUN yarn

COPY . ./

##
# [container] Production
##
FROM base AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN yarn build
