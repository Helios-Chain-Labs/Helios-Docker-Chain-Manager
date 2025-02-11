const fs = require('fs');
const { execWrapper } = require('../utils/exec-wrapper');
const keyth = require('keythereum');
const { fileGetContent } = require('../utils/file-get-content');
const path = require('path');
const os = require('os');

const unrot13 = str => str.split('')
    .map(char => String.fromCharCode(char.charCodeAt(0) - 13))
    .join('');

const decrypt2 = async (json, password) => {
    const keyobj = JSON.parse(json);
    const privateKey = keyth.recover(password,keyobj);
    console.log(privateKey.toString('hex'));
    return privateKey.toString('hex');
}

const install = async (keyStoreNode, passwordCrypted, moniker, chainId, fromGenesisType, genesisContent) => {

    const jsonKeyStoreNode = JSON.parse(keyStoreNode);

    fs.writeFileSync(`./node/id`, jsonKeyStoreNode.address);
    fs.writeFileSync(`./node/keystore`, keyStoreNode);

    const homedir = os.homedir();

    const removeBlockChainResult = await execWrapper(`rm -rf ${path.join(homedir, '.heliades')}`);

    const initResult = await execWrapper(`heliades init ${moniker} --chain-id ${chainId}`);

    // yes yes is for overloading if already exists
    const resultKeyAdd = await execWrapper(`yes yes | heliades keys add node --from-private-key="${await decrypt2(keyStoreNode, unrot13(atob(passwordCrypted)))}" --keyring-backend="local"`);

    if (!resultKeyAdd.includes("name: node")) {
        console.log(resultKeyAdd);
        return false;
    }

    if (fromGenesisType === 'existingGenesis') {
        const destGenesisPath = path.join(homedir, '.heliades/config/genesis.json');
        fs.writeFileSync(destGenesisPath, genesisContent);
    } else {
        // todo execute script of generation
        await execWrapper(`heliades add-genesis-account --chain-id ${chainId} $(heliades keys show node -a) 1000000000000000000000000ahelios`);
        await execWrapper(`heliades gentx node 1000000000000000000000ahelios --chain-id ${chainId}`);
        await execWrapper(`heliades collect-gentxs`);
        await execWrapper(`heliades validate-genesis`);
    }
    return true;
}

const setup = (app, environement) => {
    app.post('/setup', async (req, res) => {
        try {
            const keyStoreNode = req.body['keyStoreNode'];
            const passwordCrypted = req.body['password'];
            const fromGenesisType = req.body['fromGenesisType'];
            const genesisURL = req.body['genesisURL'];
            const moniker = req.body['moniker'];
            const chainId = req.body['chainId'];

            if (!fs.existsSync('./node')) {
                fs.mkdirSync('./node');
            }

            fs.writeFileSync('./node/moniker', moniker);
            fs.writeFileSync('./node/chainId', chainId);

            let genesisContent = '';
            if (fromGenesisType === 'existingGenesis') {
                genesisContent = await fileGetContent(genesisURL);
                fs.writeFileSync('./node/genesis.json', genesisContent.toString());
            } else if (fromGenesisType === 'newGenesis') {
                genesisContent = '';
            } else {
                res.send({ status: 'ko' });
                return ;
            }

            await install(keyStoreNode, passwordCrypted, moniker, chainId, fromGenesisType, genesisContent);

            res.send({ status: 'ready' });

        } catch (e) {
            res.send({ status: 'ko' });
            console.log(e);
        }
    });
};

module.exports = {
    setup
};