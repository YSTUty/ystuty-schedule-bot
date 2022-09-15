
##
# [container] prepare package.json
##
FROM endeveit/docker-jq AS prePackage

COPY package.json /tmp

RUN jq '{ dependencies, devDependencies, peerDependencies, scripts: (.scripts | { postinstall }) }' < /tmp/package.json > /tmp/prepare-package.json
# Keep `postinstall` script 

##
# [container] deps
##
FROM node:14-alpine AS deps

WORKDIR /deps

# # Install node dependencies - done in a separate step so Docker can cache it.
# COPY package*.json yarn.lock ./
COPY --from=prePackage /tmp/prepare-package.json ./package.json
COPY yarn.lock ./

RUN yarn install --pure-lockfile; \
    yarn cache clean

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
