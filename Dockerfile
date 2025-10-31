FROM node:20.9.0

# Create app directory
WORKDIR /usr/src/app

RUN mkdir -p -m 0600 ~/.ssh && ssh-keyscan github.com >> ~/.ssh/known_hosts

# Add this just before `RUN yarn install` to debug
#RUN --mount=type=secret,id=ssh_key \
#    sh -c 'cp /run/secrets/ssh_key /root/.ssh/id_rsa && chmod 600 /root/.ssh/id_rsa && echo "OK"'

# Install app dependencies
COPY package.json  ./
RUN --mount=type=ssh,id=default yarn install
#RUN yarn install

# Bundle app source
COPY . .

# Generate Prisma client
RUN yarn prisma generate

# Expose port 3000
# EXPOSE 3000

CMD ["yarn", "prod"]
