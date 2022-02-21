FROM node:17

# Create app directory
WORKDIR /usr/src/escalaralcoiaicomtat

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Install all the NPM dependencies
RUN npm install

# Copy the web data
COPY . .

EXPOSE 3000

# Start the server
CMD [ "node", "index.js" ]
