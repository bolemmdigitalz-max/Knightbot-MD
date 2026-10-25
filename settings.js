const settings = {
  packname: 'BoluDevs Bot',
  author: 'BoluDevs',
  botName: "BoluDevs Bot",
  botOwner: 'BoluDevs', // Your name
  ownerNumber: '2349033372448', // Primary owner number (country code + number, no + or spaces)
  ownerNumbers: ['2349033372448', '2349041490874'], // Every number that gets owner access
  githubRepo: '', // Optional: "your-user/your-repo" used by the .git / .github command
  giphyApiKey: '', // Optional: add your own Giphy API key if you enable the .gif command
  commandMode: "public",
  maxStoreMessages: 20, 
  storeWriteInterval: 10000,
  description: "This is a bot for managing group commands and automating tasks.",
  version: "3.0.8",
  updateZipUrl: "", // Leave empty to update from your git remote, or paste a zip URL here
};

module.exports = settings;
