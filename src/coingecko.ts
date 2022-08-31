import axios from 'axios';

const tokensCoingecko: Record<string, string> = {
  '0x152b9d0FdC40C096757F570A51E494bd4b943E50': 'bitcoin',
  '0x2b2C81e08f1Af8835a78Bb2A90AE924ACE0eA4bE': 'benqi-liquid-staked-avax',
  '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7': 'wrapped-avax',
  '0x9e295B5B976a184B14aD8cd72413aD846C299660': '',
  '0xF7D9281e8e363584973F946201b82ba72C965D27': '',
};

function getTokenPrice(token: string) {
  axios
    .get(
      'https://api.coingecko.com/api/v3/simple/price?ids=${baseId}&vs_currencies=usd'
    )
    .then((response) => {})
    .catch((error) => {
      console.log(error);
      return 0;
    });
}
