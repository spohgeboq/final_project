/* ================================================
   FactoryPool - Web3 Application
   ================================================ */

// === Global State ===
let CROWD_ABI = null;
let TOKEN_ABI = null;
let CONTRACT_ADDRESS = null;

let provider = null;
let signer = null;
let crowdfundingContract = null;
let tokenContract = null;
let userAddress = null;

// === Network Configuration ===
const ALLOWED_CHAINS = {
  11155111: 'Sepolia',
  31337: 'Hardhat Localhost',
  1337: 'Hardhat Localhost'
};

const SEPOLIA_CHAIN_ID = '0xaa36a7'; // 11155111 in hex

// === DOM Elements ===
const navbar = document.getElementById('navbar');
const connectWalletBtn = document.getElementById('connect-wallet-btn');
const gatekeeper = document.getElementById('gatekeeper');
const gatekeeperConnectBtn = document.getElementById('gatekeeper-connect-btn');
const dashboard = document.getElementById('dashboard');
const tabFactory = document.getElementById('tab-factory');
const tabSeller = document.getElementById('tab-seller');
const factoryView = document.getElementById('factory-view');
const sellerView = document.getElementById('seller-view');

// === Initialization ===
async function init() {
  try {
    console.log('🚀 Initializing FactoryPool...');

    // Загрузка артефактов контрактов
    const [crowdfundingData, tokenData, addressData] = await Promise.all([
      fetch('./Crowdfunding.json').then(res => res.json()),
      fetch('./RewardToken.json').then(res => res.json()),
      fetch('./contract-address.json').then(res => res.json())
    ]);

    // Извлечение ABI и адресов
    CROWD_ABI = crowdfundingData.abi;
    TOKEN_ABI = tokenData.abi;
    CONTRACT_ADDRESS = addressData;

    console.log('✅ Artifacts loaded:', CONTRACT_ADDRESS);

    // Подключение обработчиков событий
    setupEventListeners();

    // Показать gatekeeper для подключения кошелька
    showGatekeeper();

  } catch (error) {
    console.error('❌ Failed to initialize:', error);
    alert('Failed to load contract artifacts. Check console for details.');
  }
}

// === Event Listeners Setup ===
function setupEventListeners() {
  // Кнопки подключения кошелька
  connectWalletBtn.addEventListener('click', connectWallet);
  gatekeeperConnectBtn.addEventListener('click', connectWallet);

  // Переключение табов
  tabFactory.addEventListener('click', () => switchTab('factory'));
  tabSeller.addEventListener('click', () => switchTab('seller'));

  // Слушаем изменения в MetaMask
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
  }
}

// === Network Validation ===
async function validateNetwork() {
  const network = await provider.getNetwork();
  const chainId = Number(network.chainId);

  console.log('🔗 Current chain ID:', chainId);

  if (!ALLOWED_CHAINS[chainId]) {
    console.warn('⚠️ Wrong network detected:', chainId);

    const shouldSwitch = confirm(
      '⚠️ Wrong Network!\n\n' +
      'Please switch to Sepolia or Hardhat Localhost.\n\n' +
      'Click OK to switch to Sepolia automatically.'
    );

    if (shouldSwitch) {
      await switchToSepolia();
    }

    return false;
  }

  console.log('✅ Connected to:', ALLOWED_CHAINS[chainId]);
  return true;
}

// === Switch to Sepolia Network ===
async function switchToSepolia() {
  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SEPOLIA_CHAIN_ID }]
    });
  } catch (error) {
    // Если сеть не добавлена в MetaMask (error 4902)
    if (error.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [{
            chainId: SEPOLIA_CHAIN_ID,
            chainName: 'Sepolia Testnet',
            nativeCurrency: {
              name: 'SepoliaETH',
              symbol: 'SEP',
              decimals: 18
            },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io']
          }]
        });
      } catch (addError) {
        console.error('❌ Failed to add Sepolia network:', addError);
      }
    } else {
      console.error('❌ Failed to switch network:', error);
    }
  }
}

// === Handle Chain Changed ===
function handleChainChanged(chainId) {
  console.log('🔄 Chain changed to:', chainId);
  // Перезагрузка страницы при смене сети
  window.location.reload();
}

// === Wallet Connection ===
async function connectWallet() {
  try {
    // Проверка наличия MetaMask
    if (!window.ethereum) {
      alert('🦊 Please install MetaMask to use this application!');
      return;
    }

    console.log('🔗 Connecting wallet...');

    // Запрос доступа к аккаунтам
    await window.ethereum.request({ method: 'eth_requestAccounts' });

    // Создание провайдера и подписанта (ethers.js v6)
    provider = new ethers.BrowserProvider(window.ethereum);

    // Проверка сети ПЕРЕД продолжением
    const isValidNetwork = await validateNetwork();
    if (!isValidNetwork) {
      return; // Не продолжаем если сеть неверная
    }

    signer = await provider.getSigner();
    userAddress = await signer.getAddress();

    console.log('✅ Wallet connected:', userAddress);

    // Инициализация контрактов
    initContracts();

    // Обновление UI
    updateWalletUI();
    showDashboard();

  } catch (error) {
    console.error('❌ Wallet connection failed:', error);

    if (error.code === 4001) {
      alert('Connection rejected. Please approve the connection request.');
    } else {
      alert('Failed to connect wallet. Check console for details.');
    }
  }
}

// === Initialize Contracts ===
function initContracts() {
  crowdfundingContract = new ethers.Contract(
    CONTRACT_ADDRESS.Crowdfunding,
    CROWD_ABI,
    signer
  );

  tokenContract = new ethers.Contract(
    CONTRACT_ADDRESS.RewardToken,
    TOKEN_ABI,
    signer
  );

  console.log('✅ Contracts initialized');
}

// === Handle Account Changes ===
async function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    // Пользователь отключился
    console.log('🔌 Wallet disconnected');
    userAddress = null;
    showGatekeeper();
    connectWalletBtn.textContent = 'Connect Wallet';
  } else {
    // Смена аккаунта
    userAddress = accounts[0];
    signer = await provider.getSigner();
    initContracts();
    updateWalletUI();
    console.log('🔄 Account changed:', userAddress);
  }
}

// === UI Updates ===
function updateWalletUI() {
  // Форматирование адреса: 0x1234...5678
  const shortAddress = `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}`;
  connectWalletBtn.textContent = shortAddress;
  connectWalletBtn.classList.add('connected');
}

// === Update User Stats (Balances) ===
async function updateUserStats() {
  try {
    const userStatsEl = document.getElementById('user-stats');
    const ethBalanceEl = document.getElementById('eth-balance');
    const tokenBalanceEl = document.getElementById('token-balance');

    // Получаем баланс ETH
    const ethBalance = await provider.getBalance(userAddress);
    const ethFormatted = parseFloat(ethers.formatEther(ethBalance)).toFixed(4);
    ethBalanceEl.textContent = ethFormatted;

    // Получаем баланс токенов
    const tokenBalance = await tokenContract.balanceOf(userAddress);
    const tokenFormatted = ethers.formatEther(tokenBalance);
    tokenBalanceEl.textContent = parseFloat(tokenFormatted).toFixed(2);

    // Показываем статы
    userStatsEl.classList.remove('hidden');
    userStatsEl.classList.add('flex');

    console.log('📊 User stats updated:', { eth: ethFormatted, tokens: tokenFormatted });
  } catch (error) {
    console.error('❌ Failed to update user stats:', error);
  }
}

function showGatekeeper() {
  gatekeeper.hidden = false;
  dashboard.hidden = true;
}

function showDashboard() {
  gatekeeper.hidden = true;
  dashboard.hidden = false;

  // Загрузка кампаний и обновление статов
  loadCampaigns();
  updateUserStats();
}

// === Tab Switching ===
function switchTab(tab) {
  if (tab === 'factory') {
    tabFactory.classList.add('active');
    tabSeller.classList.remove('active');
    factoryView.hidden = false;
    sellerView.hidden = true;
  } else {
    tabFactory.classList.remove('active');
    tabSeller.classList.add('active');
    factoryView.hidden = true;
    sellerView.hidden = false;
  }
}

// === Campaign Creation ===
async function createCampaign() {
  const titleInput = document.getElementById('campaign-title');
  const goalInput = document.getElementById('campaign-goal');
  const daysInput = document.getElementById('campaign-days');
  const hoursInput = document.getElementById('campaign-hours');
  const minutesInput = document.getElementById('campaign-minutes');
  const submitBtn = document.getElementById('create-campaign-btn');

  // Валидация
  const title = titleInput.value.trim();
  const goalEth = goalInput.value;
  const days = parseInt(daysInput.value) || 0;
  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;

  if (!title || !goalEth) {
    alert('⚠️ Please fill in title and goal!');
    return;
  }

  // Проверка что хотя бы какая-то длительность указана
  if (days === 0 && hours === 0 && minutes === 0) {
    alert('⚠️ Please set a duration (at least 1 minute)!');
    return;
  }

  // Сохраняем оригинальный текст кнопки
  const originalBtnText = submitBtn.textContent;

  try {
    // UX: Показываем статус загрузки
    submitBtn.textContent = '⏳ Creating...';
    submitBtn.disabled = true;

    // Конвертация значений
    const goalWei = ethers.parseEther(goalEth);

    // Расчёт длительности в секундах
    const durationSeconds = (days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60);

    console.log('📝 Creating campaign:', {
      title,
      goalWei: goalWei.toString(),
      durationSeconds,
      duration: `${days}d ${hours}h ${minutes}m`
    });

    // Вызов контракта
    const tx = await crowdfundingContract.createCampaign(
      title,
      goalWei,
      durationSeconds
    );

    // Ожидание подтверждения транзакции
    submitBtn.textContent = '⛏️ Mining...';
    console.log('⏳ Waiting for transaction:', tx.hash);

    await tx.wait();

    console.log('✅ Campaign created successfully!');
    alert('🎉 Campaign created successfully!');

    // Очистка формы
    titleInput.value = '';
    goalInput.value = '';
    durationInput.value = '';

    // Обновление списка кампаний
    await loadCampaigns();

  } catch (error) {
    console.error('❌ Failed to create campaign:', error);

    if (error.code === 'ACTION_REJECTED') {
      alert('Transaction was rejected by user.');
    } else if (error.reason) {
      alert(`Error: ${error.reason}`);
    } else {
      alert('Failed to create campaign. Check console for details.');
    }
  } finally {
    // Восстанавливаем кнопку
    submitBtn.textContent = originalBtnText;
    submitBtn.disabled = false;
  }
}

// === Load & Render Campaigns ===
async function loadCampaigns() {
  try {
    console.log('📦 Loading campaigns...');

    // Получаем количество кампаний
    const campaignCount = await crowdfundingContract.campaignCount();
    console.log('📋 Total campaigns:', campaignCount.toString());

    // Загружаем каждую кампанию отдельно
    const campaigns = [];
    for (let i = 0; i < campaignCount; i++) {
      const campaign = await crowdfundingContract.getCampaign(i);
      campaigns.push(campaign);
    }

    // Очищаем контейнер
    sellerView.innerHTML = '';

    // Если кампаний нет
    if (campaigns.length === 0) {
      sellerView.innerHTML = `
        <div class="card" style="text-align: center; padding: 3rem;">
          <div class="text-5xl mb-4">📭</div>
          <h3 class="text-xl font-semibold mb-2">No Campaigns Yet</h3>
          <p class="text-gray-400">Be the first to create a campaign!</p>
        </div>
      `;
      return;
    }

    // Создаём сетку карточек
    const grid = document.createElement('div');
    grid.className = 'campaigns-grid';

    // Текущее время для расчёта оставшегося времени
    const now = Math.floor(Date.now() / 1000);

    campaigns.forEach((campaign, index) => {
      // Деструктуризация данных кампании
      const owner = campaign.creator;
      const title = campaign.title;
      const goal = campaign.fundingGoal;
      const pledged = campaign.totalRaised;
      const deadline = Number(campaign.deadline);
      const finalized = campaign.finalized;

      // Расчёты
      const goalEth = ethers.formatEther(goal);
      const pledgedEth = ethers.formatEther(pledged);
      const progress = goal > 0n ? Number((pledged * 100n) / goal) : 0;
      const progressCapped = Math.min(progress, 100);

      // Время
      const timeLeft = deadline - now;
      const isExpired = timeLeft <= 0;
      const timeLeftText = isExpired ? 'Ended' : formatTimeLeft(timeLeft);

      // Статус
      let statusBadge = '';
      if (finalized) {
        statusBadge = '<span class="badge badge-completed">✓ Finalized</span>';
      } else if (isExpired) {
        statusBadge = progress >= 100
          ? '<span class="badge badge-active">🎉 Goal Reached</span>'
          : '<span class="badge badge-pending">⏰ Expired</span>';
      } else {
        statusBadge = '<span class="badge badge-active">🔥 Active</span>';
      }

      // HTML карточки
      const cardHTML = `
        <div class="campaign-card" data-campaign-id="${index}">
          <div class="campaign-card-header">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-lg font-semibold">${escapeHtml(title)}</h3>
              ${statusBadge}
            </div>
            <p class="text-sm text-gray-400">by ${owner.slice(0, 6)}...${owner.slice(-4)}</p>
          </div>

          <div class="campaign-card-body">
            <!-- Progress Bar -->
            <div class="mb-4">
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-400">Progress</span>
                <span class="font-medium">${progressCapped}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-bar-fill" style="width: ${progressCapped}%"></div>
              </div>
            </div>

            <!-- Stats -->
            <div class="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p class="text-gray-400">Raised</p>
                <p class="font-semibold text-gradient">${parseFloat(pledgedEth).toFixed(4)} ETH</p>
              </div>
              <div>
                <p class="text-gray-400">Goal</p>
                <p class="font-semibold">${parseFloat(goalEth).toFixed(4)} ETH</p>
              </div>
              <div>
                <p class="text-gray-400">Time Left</p>
                <p class="font-semibold ${isExpired ? 'text-red-400' : ''}">${timeLeftText}</p>
              </div>
              <div>
                <p class="text-gray-400">Backers</p>
                <p class="font-semibold">—</p>
              </div>
            </div>
          </div>

          ${!finalized ? `
          <div class="campaign-card-footer">
            ${!isExpired ? `
            <!-- Active Campaign: Contribute -->
            <div class="flex gap-2">
              <input 
                type="number" 
                id="contribute-amount-${index}"
                class="input-field flex-1" 
                placeholder="0.01 ETH"
                step="0.001"
                min="0.001"
              >
              <button 
                class="btn-primary"
                onclick="contribute(${index})"
              >
                💰 Contribute
              </button>
            </div>
            ` : `
            <!-- Expired: Finalize Campaign -->
            <button 
              class="btn-secondary w-full"
              onclick="finalizeCampaign(${index})"
            >
              ✅ Finalize Campaign
            </button>
            `}
          </div>
          ` : ''}
        </div>
      `;

      grid.innerHTML += cardHTML;
    });

    sellerView.appendChild(grid);
    console.log('✅ Campaigns rendered');

  } catch (error) {
    console.error('❌ Failed to load campaigns:', error);
    sellerView.innerHTML = `
      <div class="card" style="text-align: center; padding: 3rem;">
        <div class="text-5xl mb-4">⚠️</div>
        <h3 class="text-xl font-semibold mb-2 text-red-400">Failed to Load Campaigns</h3>
        <p class="text-gray-400">${error.message || 'Check console for details'}</p>
        <button class="btn-secondary mt-4" onclick="loadCampaigns()">🔄 Retry</button>
      </div>
    `;
  }
}

// === Contribute to Campaign ===
async function contribute(campaignId) {
  const amountInput = document.getElementById(`contribute-amount-${campaignId}`);
  const contributeBtn = amountInput.parentElement.querySelector('.btn-primary');

  // Получаем значение
  const amountEth = amountInput.value;

  if (!amountEth || parseFloat(amountEth) <= 0) {
    alert('⚠️ Please enter a valid amount!');
    return;
  }

  // Сохраняем оригинальный текст кнопки
  const originalBtnText = contributeBtn.innerHTML;

  try {
    // UX: Показываем статус загрузки
    contributeBtn.innerHTML = '⏳ Processing...';
    contributeBtn.disabled = true;
    amountInput.disabled = true;

    // Конвертация ETH в Wei
    const amountWei = ethers.parseEther(amountEth);

    console.log('💰 Contributing to campaign:', {
      campaignId,
      amountEth,
      amountWei: amountWei.toString()
    });

    // Вызов контракта с отправкой ETH (метод называется contribute, не pledge)
    const tx = await crowdfundingContract.contribute(campaignId, {
      value: amountWei
    });

    // Ожидание подтверждения
    contributeBtn.innerHTML = '⛏️ Mining...';
    console.log('⏳ Waiting for transaction:', tx.hash);

    await tx.wait();

    console.log('✅ Contribution successful!');
    alert(`🎉 Successfully contributed ${amountEth} ETH!`);

    // Очистка поля ввода
    amountInput.value = '';

    // Обновление списка кампаний для отображения нового прогресса
    await loadCampaigns();

  } catch (error) {
    console.error('❌ Contribution failed:', error);

    if (error.code === 'ACTION_REJECTED') {
      alert('Transaction was rejected by user.');
    } else if (error.reason) {
      alert(`Error: ${error.reason}`);
    } else {
      alert('Failed to contribute. Check console for details.');
    }

    // Восстанавливаем кнопку при ошибке
    contributeBtn.innerHTML = originalBtnText;
    contributeBtn.disabled = false;
    amountInput.disabled = false;
  }
}

// === Finalize Campaign ===
async function finalizeCampaign(campaignId) {
  const btn = event.target;
  const originalText = btn.innerHTML;

  try {
    btn.innerHTML = '⏳ Processing...';
    btn.disabled = true;

    console.log('✅ Finalizing campaign:', campaignId);

    const tx = await crowdfundingContract.finalizeCampaign(campaignId);

    btn.innerHTML = '⛏️ Mining...';
    console.log('⏳ Waiting for transaction:', tx.hash);

    await tx.wait();

    console.log('✅ Campaign finalized!');
    alert('🎉 Campaign finalized successfully!');

    // Обновление UI
    await loadCampaigns();
    await updateUserStats();

  } catch (error) {
    console.error('❌ Finalization failed:', error);

    if (error.code === 'ACTION_REJECTED') {
      alert('Transaction was rejected by user.');
    } else if (error.reason) {
      alert(`Error: ${error.reason}`);
    } else {
      alert('Failed to finalize campaign. Check console for details.');
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// === Helper: Format Time Left ===
function formatTimeLeft(seconds) {
  if (seconds <= 0) return 'Ended';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// === Helper: Escape HTML ===
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// === Run on Window Load ===
window.addEventListener('load', init);
