let initiatedNames = [];
try {
  initiatedNames = require('./data/initiatedNames.json');
} catch (error) {
  console.error("Could not load initiatedNames.json:", error.message);
}

let prophecies = {};
try {
  prophecies = require('./data/prophecies.json');
} catch (error) {
  console.error("Could not load prophecies.json:", error.message);
}

module.exports = {
    initiatedNames,
    prophecies
};
