const ethers = require('ethers');

const generateJsonKeyStore = async (privateKey, password) => {
    try {
        const wallet = new ethers.Wallet(privateKey);
        
        // works only with ethers@5.1.4
        const json = await wallet.encrypt(password, {
            scrypt: {
                // The number must be a power of 2 (default: 131072)
                N: 64
            }
        });
        return json;
    } catch (e) {
        return undefined;
    }
};

module.exports = {
    generateJsonKeyStore
};