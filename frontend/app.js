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

// === Toast Notification System ===
const toastContainer = document.getElementById('toast-container');

const TOAST_ICONS = {
  success: `<svg class="toast-icon toast-icon-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
  </svg>`,
  error: `<svg class="toast-icon toast-icon-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
  </svg>`,
  loading: `<svg class="toast-icon toast-icon-loading" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
  </svg>`,
  info: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" style="color: #6366f1;">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
  </svg>`
};

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;

  toast.innerHTML = `
    ${icon}
    <span class="toast-message">${message}</span>
  `;

  toastContainer.appendChild(toast);

  // Auto-remove after 4 seconds (except for loading toasts)
  if (type !== 'loading') {
    setTimeout(() => {
      removeToast(toast);
    }, 4000);
  }

  return toast;
}

function removeToast(toast) {
  if (!toast || !toast.parentNode) return;

  toast.classList.add('toast-exit');
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 300);
}

// === Ethereum Blockies Avatar ===
function renderAvatar(address, size = 8, scale = 4) {
  if (!address || !window.blockies) return null;

  try {
    const avatar = blockies.create({
      seed: address.toLowerCase(),
      size: size,
      scale: scale
    });
    return avatar.toDataURL();
  } catch (error) {
    console.error('Failed to create blockie:', error);
    return null;
  }
}

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

  // Автоматический расчёт Total Goal
  const quantityInput = document.getElementById('target-quantity');
  const priceInput = document.getElementById('price-per-unit');
  if (quantityInput && priceInput) {
    quantityInput.addEventListener('input', calculateTotalGoal);
    priceInput.addEventListener('input', calculateTotalGoal);
  }

  // Слушаем изменения в MetaMask
  if (window.ethereum) {
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
  }
}

// === Calculate Total Goal (Quantity * Price Per Unit) ===
function calculateTotalGoal() {
  const quantity = parseFloat(document.getElementById('target-quantity').value) || 0;
  const pricePerUnit = parseFloat(document.getElementById('price-per-unit').value) || 0;
  const totalGoal = quantity * pricePerUnit;

  const displayEl = document.getElementById('calculated-goal');
  if (displayEl) {
    displayEl.textContent = `${totalGoal.toFixed(4)} ETH`;
  }

  return totalGoal;
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
      showToast('🦊 Please install MetaMask to use this application!', 'error');
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

    showToast('Wallet connected successfully!', 'success');

  } catch (error) {
    console.error('❌ Wallet connection failed:', error);

    if (error.code === 4001) {
      showToast('Connection rejected. Please approve the request.', 'error');
    } else {
      showToast('Failed to connect wallet', 'error');
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

  // Отображение аватара пользователя
  const userAvatarContainer = document.getElementById('user-avatar');
  const userAvatarImg = document.getElementById('user-avatar-img');

  if (userAvatarContainer && userAvatarImg) {
    const avatarUrl = renderAvatar(userAddress, 8, 4);
    if (avatarUrl) {
      userAvatarImg.src = avatarUrl;
      userAvatarContainer.classList.remove('hidden');
    }
  }
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

    // Получаем баланс токенов (Reward Tokens = Orders)
    const tokenBalance = await tokenContract.balanceOf(userAddress);
    const tokenFormatted = ethers.formatEther(tokenBalance);
    // Показываем как целое число (без дробной части)
    tokenBalanceEl.textContent = Math.floor(parseFloat(tokenFormatted));

    // Показываем статы
    userStatsEl.classList.remove('hidden');
    userStatsEl.classList.add('flex');

    console.log('📊 User stats updated:', { eth: ethFormatted, tokens: tokenFormatted });
  } catch (error) {
    console.error('❌ Failed to update user stats:', error);
  }
}

// === Add Token to MetaMask ===
async function addTokenToMetaMask() {
  try {
    if (!window.ethereum) {
      showToast('🦊 MetaMask is not installed!', 'error');
      return;
    }

    const tokenAddress = CONTRACT_ADDRESS.RewardToken;
    const tokenSymbol = 'CWD'; // CrowdReward Token (from RewardToken.sol)
    const tokenDecimals = 18;

    const wasAdded = await window.ethereum.request({
      method: 'wallet_watchAsset',
      params: {
        type: 'ERC20',
        options: {
          address: tokenAddress,
          symbol: tokenSymbol,
          decimals: tokenDecimals,
        },
      },
    });

    if (wasAdded) {
      console.log('✅ CWD Token added to MetaMask!');
      showToast('🎉 CrowdReward (CWD) Token added to wallet!', 'success');
    } else {
      console.log('❌ User declined to add token');
      showToast('Token addition cancelled', 'info');
    }
  } catch (error) {
    console.error('❌ Failed to add token to MetaMask:', error);
    showToast('Failed to add token to MetaMask', 'error');
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
  renderFactoryDashboard();
}

// === Factory Dashboard: Render Owner's Campaigns ===
// Hidden campaigns stored in localStorage
function getHiddenCampaigns() {
  try {
    const hidden = localStorage.getItem('factorypool_hidden_campaigns');
    return hidden ? JSON.parse(hidden) : [];
  } catch {
    return [];
  }
}

function hideFactoryCampaign(campaignId) {
  const hidden = getHiddenCampaigns();
  if (!hidden.includes(campaignId)) {
    hidden.push(campaignId);
    localStorage.setItem('factorypool_hidden_campaigns', JSON.stringify(hidden));
  }
  renderFactoryDashboard();
  showToast('Campaign hidden from dashboard', 'info');
}

async function renderFactoryDashboard() {
  const grid = document.getElementById('factory-campaigns-grid');
  const totalCampaignsEl = document.getElementById('factory-total-campaigns');
  const totalRaisedEl = document.getElementById('factory-total-raised');

  if (!grid || !crowdfundingContract || !userAddress) return;

  try {
    // Получаем скрытые кампании из localStorage
    const hiddenCampaigns = getHiddenCampaigns();

    // Получаем количество кампаний и загружаем каждую по id
    const campaignCount = await crowdfundingContract.campaignCount();
    const now = Math.floor(Date.now() / 1000);

    // Фильтрация кампаний владельца (исключая finalized и скрытые)
    const myCampaigns = [];
    let totalRaised = 0n;

    for (let i = 0; i < campaignCount; i++) {
      const campaign = await crowdfundingContract.campaigns(i);

      // Только кампании текущего пользователя
      if (campaign.creator.toLowerCase() !== userAddress.toLowerCase()) continue;

      // Пропускаем deleted (отменённые в блокчейне), finalized (уже выведены средства) и скрытые локально
      if (campaign.deleted || campaign.finalized || hiddenCampaigns.includes(i)) continue;

      // Явно извлекаем свойства
      myCampaigns.push({
        id: i,
        campaignId: campaign.campaignId,
        title: campaign.title,
        creator: campaign.creator,
        fundingGoal: campaign.fundingGoal,
        deadline: campaign.deadline,
        totalRaised: campaign.totalRaised,
        finalized: campaign.finalized,
        deleted: campaign.deleted
      });
      totalRaised += campaign.totalRaised;
    }

    // Обновление статистики
    if (totalCampaignsEl) totalCampaignsEl.textContent = myCampaigns.length;
    if (totalRaisedEl) totalRaisedEl.textContent = `${parseFloat(ethers.formatEther(totalRaised)).toFixed(4)} ETH`;

    // Если нет кампаний
    if (myCampaigns.length === 0) {
      grid.innerHTML = `
        <div class="card text-center py-8 opacity-60 col-span-full">
          <p class="text-gray-400">No campaigns created yet. Create your first production batch above!</p>
        </div>
      `;
      return;
    }

    // Рендеринг кампаний
    grid.innerHTML = '';

    myCampaigns.forEach((campaign) => {
      const index = campaign.id;
      const rawTitle = campaign.title;
      const [title, customImageUrl] = rawTitle.split('|||');

      const goal = campaign.fundingGoal;
      const pledged = campaign.totalRaised;
      const deadline = Number(campaign.deadline);
      const finalized = campaign.finalized;

      const goalEth = ethers.formatEther(goal);
      const pledgedEth = ethers.formatEther(pledged);
      const goalNum = parseFloat(goalEth);
      const pledgedNum = parseFloat(pledgedEth);
      const progress = goalNum > 0 ? (pledgedNum / goalNum) * 100 : 0;
      const progressCapped = Math.min(Math.round(progress), 100);

      const timeLeft = deadline - now;
      const isExpired = timeLeft <= 0;
      const timeLeftText = isExpired ? 'Ended' : formatTimeLeft(timeLeft);
      const isGoalReached = pledgedNum >= goalNum && goalNum > 0;

      // Статус badge
      let statusBadge = '';
      if (finalized) {
        statusBadge = '<span class="badge badge-completed">✓ Withdrawn</span>';
      } else if (isGoalReached) {
        statusBadge = '<span class="badge badge-success">🎉 Goal Reached!</span>';
      } else if (isExpired) {
        statusBadge = '<span class="badge badge-pending">⏰ Expired</span>';
      } else {
        statusBadge = '<span class="badge badge-active">🔥 Active</span>';
      }

      // Image HTML
      let imageHTML = '';
      if (customImageUrl && customImageUrl.trim()) {
        imageHTML = `
          <div class="card-image-container">
            <img src="${escapeHtml(customImageUrl.trim())}" class="card-image" alt="Product" loading="lazy" onerror="this.parentElement.style.display='none'">
          </div>
        `;
      }

      // Action buttons
      let actionHTML = '';
      if (!finalized) {
        if (isGoalReached && isExpired) {
          // Goal reached & expired - can withdraw
          actionHTML = `
            <button class="btn-success w-full" onclick="claimFunds(${index})">
              💰 Withdraw ${pledgedNum.toFixed(4)} ETH
            </button>
          `;
        } else if (isGoalReached && !isExpired) {
          // Goal reached but not expired yet
          actionHTML = `
            <div class="text-center py-2">
              <span class="text-green-400 font-semibold">🎉 Goal Reached!</span>
              <p class="text-gray-400 text-xs mt-1">Withdraw available in: ${timeLeftText}</p>
            </div>
          `;
        } else if (pledgedNum === 0 && !isExpired) {
          // ❌ No investors = Can DELETE/CANCEL via blockchain
          actionHTML = `
            <button class="btn-danger w-full" onclick="cancelCampaignHandler(${index})">
              ❌ Delete Campaign
            </button>
          `;
        } else if (!isExpired) {
          // Active with some investments
          actionHTML = `
            <div class="text-center py-2">
              <span class="text-indigo-400">📈 Funding in progress</span>
              <p class="text-gray-400 text-xs mt-1">${progressCapped}% funded • ${timeLeftText} left</p>
            </div>
          `;
        } else {
          // Expired but goal not reached (with some funds) - can only archive locally
          actionHTML = `
            <div class="text-center py-2">
              <span class="text-red-400">❌ Goal not reached</span>
              <p class="text-gray-400 text-xs mt-1">Campaign ended • ${pledgedNum.toFixed(4)} ETH raised</p>
              <button class="btn-secondary w-full mt-2 text-xs" onclick="hideFactoryCampaign(${index})">
                Archive Campaign
              </button>
            </div>
          `;
        }
      } else {
        actionHTML = `
          <div class="text-center py-2">
            <span class="text-gray-400">✅ Funds claimed</span>
          </div>
        `;
      }

      const cardHTML = `
        <div class="campaign-card factory-card" data-campaign-id="${index}">
          ${imageHTML}
          <div class="campaign-card-header">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-lg font-semibold">${escapeHtml(title)}</h3>
              ${statusBadge}
            </div>
          </div>
          
          <div class="campaign-card-body">
            <!-- Progress Bar -->
            <div class="mb-4">
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-400">Progress</span>
                <span class="font-medium ${isGoalReached ? 'text-green-400' : ''}">${progressCapped}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-bar-fill ${isGoalReached ? 'bg-green-500' : ''}" style="width: ${progressCapped}%"></div>
              </div>
            </div>
            
            <!-- Stats -->
            <div class="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p class="text-gray-400">Raised</p>
                <p class="font-semibold text-gradient">${pledgedNum.toFixed(4)} ETH</p>
              </div>
              <div>
                <p class="text-gray-400">Goal</p>
                <p class="font-semibold">${goalNum.toFixed(4)} ETH</p>
              </div>
              <div>
                <p class="text-gray-400">Time Left</p>
                <p class="font-semibold ${isExpired ? 'text-red-400' : ''}">${timeLeftText}</p>
              </div>
              <div>
                <p class="text-gray-400">Status</p>
                <p class="font-semibold">${finalized ? 'Completed' : 'Active'}</p>
              </div>
            </div>
          </div>
          
          <div class="campaign-card-footer">
            ${actionHTML}
          </div>
        </div>
      `;

      grid.innerHTML += cardHTML;
    });

  } catch (error) {
    console.error('Failed to render factory dashboard:', error);
    grid.innerHTML = `
      <div class="card text-center py-8 col-span-full">
        <p class="text-red-400">Failed to load campaigns. Please try again.</p>
      </div>
    `;
  }
}

// === Claim/Withdraw Funds ===
async function claimFunds(campaignId) {
  let loadingToast = null;

  try {
    loadingToast = showToast('Processing withdrawal...', 'loading');

    console.log('💰 Claiming funds for campaign:', campaignId);

    const tx = await crowdfundingContract.finalizeCampaign(campaignId);

    removeToast(loadingToast);
    loadingToast = showToast('Mining transaction...', 'loading');
    console.log('⏳ Waiting for transaction:', tx.hash);

    await tx.wait();

    removeToast(loadingToast);
    console.log('✅ Funds claimed successfully!');
    showToast('🎉 Funds transferred to your wallet!', 'success');

    // Обновление UI
    await loadCampaigns();
    await updateUserStats();
    await renderFactoryDashboard();

  } catch (error) {
    console.error('❌ Claim failed:', error);
    if (loadingToast) removeToast(loadingToast);

    if (error.code === 'ACTION_REJECTED') {
      showToast('Transaction was rejected by user', 'error');
    } else if (error.reason) {
      showToast(`Error: ${error.reason}`, 'error');
    } else {
      showToast('Failed to claim funds', 'error');
    }
  }
}

// === Cancel Campaign (Blockchain Call) ===
async function cancelCampaignHandler(campaignId) {
  let loadingToast = null;

  try {
    loadingToast = showToast('Cancelling campaign...', 'loading');

    console.log('❌ Cancelling campaign:', campaignId);

    const tx = await crowdfundingContract.cancelCampaign(campaignId);

    removeToast(loadingToast);
    loadingToast = showToast('Mining transaction...', 'loading');
    console.log('⏳ Waiting for transaction:', tx.hash);

    await tx.wait();

    removeToast(loadingToast);
    console.log('✅ Campaign cancelled successfully!');
    showToast('🗑️ Campaign deleted from blockchain!', 'success');

    // Обновление UI
    await loadCampaigns();
    await updateUserStats();
    await renderFactoryDashboard();

  } catch (error) {
    console.error('❌ Cancel failed:', error);
    if (loadingToast) removeToast(loadingToast);

    if (error.code === 'ACTION_REJECTED') {
      showToast('Transaction was rejected by user', 'error');
    } else if (error.reason) {
      showToast(`Error: ${error.reason}`, 'error');
    } else {
      showToast('Failed to cancel campaign', 'error');
    }
  }
}

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
  const companyInput = document.getElementById('company-name');
  const productInput = document.getElementById('product-name');
  const quantityInput = document.getElementById('target-quantity');
  const priceInput = document.getElementById('price-per-unit');
  const daysInput = document.getElementById('campaign-days');
  const hoursInput = document.getElementById('campaign-hours');
  const minutesInput = document.getElementById('campaign-minutes');
  const submitBtn = document.getElementById('create-campaign-btn');

  // Валидация
  const companyName = companyInput.value.trim();
  const productName = productInput.value.trim();
  const quantity = parseInt(quantityInput.value) || 0;
  const pricePerUnit = parseFloat(priceInput.value) || 0;
  const days = parseInt(daysInput.value) || 0;
  const hours = parseInt(hoursInput.value) || 0;
  const minutes = parseInt(minutesInput.value) || 0;

  // Получаем опциональный URL изображения
  const imageUrlInput = document.getElementById('product-image-url');
  const imageUrl = imageUrlInput ? imageUrlInput.value.trim() : '';

  if (!companyName || !productName) {
    showToast('Please fill in Company Name and Product Name!', 'error');
    return;
  }

  if (quantity <= 0 || pricePerUnit <= 0) {
    showToast('Please enter valid Quantity and Price Per Unit!', 'error');
    return;
  }

  // Проверка что хотя бы какая-то длительность указана
  if (days === 0 && hours === 0 && minutes === 0) {
    showToast('Please set a duration (at least 1 minute)!', 'error');
    return;
  }

  // Рассчитываем Total Goal
  const totalGoalEth = quantity * pricePerUnit;

  // Формируем title для блокчейна: "Company - Product (Qty pcs)"
  // Если есть URL изображения, добавляем его через разделитель "|||"
  let title = `${companyName} - ${productName} (${quantity} pcs)`;
  if (imageUrl) {
    title = `${title}|||${imageUrl}`;
  }

  // Сохраняем оригинальный текст кнопки
  const originalBtnText = submitBtn.textContent;

  let loadingToast = null;

  try {
    // UX: Показываем статус загрузки
    submitBtn.textContent = '⏳ Creating...';
    submitBtn.disabled = true;
    loadingToast = showToast('Creating campaign...', 'loading');

    // Конвертация значений
    const goalWei = ethers.parseEther(totalGoalEth.toString());

    // Расчёт длительности в секундах
    const durationSeconds = (days * 24 * 60 * 60) + (hours * 60 * 60) + (minutes * 60);

    console.log('📝 Creating campaign:', {
      title,
      quantity,
      pricePerUnit,
      totalGoalEth,
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
    removeToast(loadingToast);
    loadingToast = showToast('Mining transaction...', 'loading');
    console.log('⏳ Waiting for transaction:', tx.hash);

    await tx.wait();

    removeToast(loadingToast);
    console.log('✅ Campaign created successfully!');
    showToast('🎉 Production batch launched successfully!', 'success');

    // Очистка формы
    companyInput.value = '';
    productInput.value = '';
    quantityInput.value = '';
    priceInput.value = '';
    daysInput.value = '0';
    hoursInput.value = '0';
    minutesInput.value = '5';
    document.getElementById('calculated-goal').textContent = '0.00 ETH';
    if (imageUrlInput) imageUrlInput.value = '';

    // Обновление списка кампаний и Factory Dashboard
    await loadCampaigns();
    await renderFactoryDashboard();

  } catch (error) {
    console.error('❌ Failed to create campaign:', error);
    if (loadingToast) removeToast(loadingToast);

    if (error.code === 'ACTION_REJECTED') {
      showToast('Transaction was rejected by user', 'error');
    } else if (error.reason) {
      showToast(`Error: ${error.reason}`, 'error');
    } else {
      showToast('Failed to create campaign', 'error');
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
      // Пропускаем отменённые кампании (deleted) - безопасная проверка для старых контрактов
      if (campaign.deleted === true) return;

      // Деструктуризация данных кампании
      const owner = campaign.creator;
      const rawTitle = campaign.title;
      const goal = campaign.fundingGoal;
      const pledged = campaign.totalRaised;
      const deadline = Number(campaign.deadline);
      const finalized = campaign.finalized;

      // Парсинг title: разделяем по "|||" для извлечения URL изображения
      const [title, customImageUrl] = rawTitle.split('|||');

      // Расчёты
      const goalEth = ethers.formatEther(goal);
      const pledgedEth = ethers.formatEther(pledged);
      const goalNum = parseFloat(goalEth);
      const pledgedNum = parseFloat(pledgedEth);
      const progress = goalNum > 0 ? (pledgedNum / goalNum) * 100 : 0;
      const progressCapped = Math.min(Math.round(progress), 100);

      // Парсим количество из title (формат: "Company - Product (Qty pcs)")
      const quantityMatch = title.match(/\((\d+)\s*pcs\)/i);
      const totalQuantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;

      // Рассчитываем Price Per Unit
      const pricePerUnit = totalQuantity > 0 ? parseFloat(goalEth) / totalQuantity : parseFloat(goalEth);
      const pricePerUnitFormatted = pricePerUnit.toFixed(6);

      // Время
      const timeLeft = deadline - now;
      const isExpired = timeLeft <= 0;
      const timeLeftText = isExpired ? 'Ended' : formatTimeLeft(timeLeft);

      // Проверка достижения цели
      const isGoalReached = pledgedNum >= goalNum && goalNum > 0;

      // Проверка владельца кампании
      const isOwner = userAddress && owner.toLowerCase() === userAddress.toLowerCase();

      // Статус
      let statusBadge = '';
      if (finalized) {
        statusBadge = '<span class="badge badge-completed">✓ Finalized</span>';
      } else if (isGoalReached) {
        statusBadge = '<span class="badge badge-success">🎉 SOLD OUT</span>';
      } else if (isExpired) {
        statusBadge = '<span class="badge badge-pending">⏰ Expired</span>';
      } else {
        statusBadge = '<span class="badge badge-active">🔥 Active</span>';
      }

      // Генерация footer в зависимости от состояния
      let footerHTML = '';

      if (!finalized) {
        if (isGoalReached && isExpired) {
          // Цель достигнута И кампания завершилась - можно вывести средства
          if (isOwner) {
            footerHTML = `
              <div class="campaign-card-footer">
                <div class="text-center mb-2">
                  <span class="text-green-400 font-semibold">🎉 Ready for Withdrawal!</span>
                </div>
                <button 
                  class="btn-success w-full"
                  onclick="withdrawFunds(${index})"
                >
                  💰 Withdraw ${parseFloat(pledgedEth).toFixed(4)} ETH
                </button>
              </div>
            `;
          } else {
            footerHTML = `
              <div class="campaign-card-footer">
                <div class="text-center py-2">
                  <span class="text-green-400">✅ Funded & Completed - Production Started!</span>
                </div>
              </div>
            `;
          }
        } else if (isGoalReached && !isExpired) {
          // Цель достигнута, но кампания ещё не завершилась
          footerHTML = `
            <div class="campaign-card-footer">
              <div class="text-center py-2">
                <span class="text-green-400 font-semibold">🎉 SOLD OUT!</span>
                <p class="text-gray-400 text-sm mt-1">Withdrawal available after campaign ends (${timeLeftText})</p>
              </div>
            </div>
          `;
        } else if (!isExpired) {
          // Активная кампания - можно покупать
          footerHTML = `
            <div class="campaign-card-footer">
              <div class="space-y-2">
                <div class="flex gap-2 items-center">
                  <input 
                    type="number" 
                    id="buy-quantity-${index}"
                    class="input-field flex-1" 
                    placeholder="Qty"
                    min="1"
                    max="${totalQuantity}"
                    oninput="calculateBuyCost(${index}, ${pricePerUnit})"
                  >
                  <span class="text-sm text-gray-400">items</span>
                </div>
                <div class="flex justify-between items-center px-2 py-1 bg-dark-800 rounded">
                  <span class="text-sm text-gray-400">Total Cost:</span>
                  <span id="buy-cost-${index}" class="font-semibold text-gradient">0.00 ETH</span>
                </div>
                <button 
                  class="btn-primary w-full"
                  onclick="contribute(${index}, ${pricePerUnit})"
                >
                  🛒 Buy Items
                </button>
              </div>
            </div>
          `;
        } else {
          // Истёкшая кампания без достижения цели
          if (isOwner) {
            footerHTML = `
              <div class="campaign-card-footer">
                <button 
                  class="btn-secondary w-full"
                  onclick="finalizeCampaign(${index})"
                >
                  ✅ Finalize Campaign
                </button>
              </div>
            `;
          } else {
            footerHTML = `
              <div class="campaign-card-footer">
                <div class="text-center py-2">
                  <span class="text-gray-400">⏰ Campaign Ended - Goal Not Reached</span>
                </div>
              </div>
            `;
          }
        }
      }

      // Генерация аватара владельца
      const ownerAvatarUrl = renderAvatar(owner, 6, 4);
      const ownerAvatarHTML = ownerAvatarUrl
        ? `<img src="${ownerAvatarUrl}" class="avatar-card" alt="Owner">`
        : '';

      // Генерация HTML для изображения (только если предоставлен customImageUrl)
      let imageHTML = '';
      if (customImageUrl && customImageUrl.trim()) {
        // Случайная категория для визуального разнообразия
        const categories = [
          { name: 'Electronics', color: 'bg-blue-500/20 text-blue-400' },
          { name: 'Clothing', color: 'bg-pink-500/20 text-pink-400' },
          { name: 'Raw Materials', color: 'bg-amber-500/20 text-amber-400' },
          { name: 'Components', color: 'bg-green-500/20 text-green-400' },
          { name: 'Machinery', color: 'bg-purple-500/20 text-purple-400' },
          { name: 'Consumer Goods', color: 'bg-cyan-500/20 text-cyan-400' }
        ];
        const category = categories[index % categories.length];

        imageHTML = `
          <div class="card-image-container">
            <img src="${escapeHtml(customImageUrl.trim())}" class="card-image" alt="Product" loading="lazy" onerror="this.parentElement.style.display='none'">
            <span class="category-badge ${category.color}">${category.name}</span>
          </div>
        `;
      }

      // HTML карточки
      const cardHTML = `
        <div class="campaign-card" data-campaign-id="${index}" data-price-per-unit="${pricePerUnit}">
          <!-- Product Image (only if custom URL provided) -->
          ${imageHTML}
          
          <div class="campaign-card-header">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-lg font-semibold">${escapeHtml(title)}</h3>
              ${statusBadge}
            </div>
            <div class="avatar-container">
              ${ownerAvatarHTML}
              <p class="text-sm text-gray-400">by ${owner.slice(0, 6)}...${owner.slice(-4)}${isOwner ? ' (You)' : ''}</p>
            </div>
          </div>

          <div class="campaign-card-body">
            <!-- Progress Bar -->
            <div class="mb-4">
              <div class="flex justify-between text-sm mb-2">
                <span class="text-gray-400">Progress</span>
                <span class="font-medium">${progressCapped}%</span>
              </div>
              <div class="progress-bar">
                <div class="progress-bar-fill ${isGoalReached ? 'bg-green-500' : ''}" style="width: ${progressCapped}%"></div>
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
                <p class="text-gray-400">Price/Unit</p>
                <p class="font-semibold text-purple-400">${pricePerUnitFormatted} ETH</p>
              </div>
              <div>
                <p class="text-gray-400">Total Items</p>
                <p class="font-semibold">${totalQuantity} pcs</p>
              </div>
              <div>
                <p class="text-gray-400">Time Left</p>
                <p class="font-semibold ${isExpired ? 'text-red-400' : ''}">${timeLeftText}</p>
              </div>
            </div>
          </div>

          ${footerHTML}
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

// === Calculate Buy Cost (Quantity * Price Per Unit) ===
function calculateBuyCost(campaignId, pricePerUnit) {
  const quantityInput = document.getElementById(`buy-quantity-${campaignId}`);
  const costDisplay = document.getElementById(`buy-cost-${campaignId}`);

  const quantity = parseInt(quantityInput.value) || 0;
  const totalCost = quantity * pricePerUnit;

  costDisplay.textContent = `${totalCost.toFixed(6)} ETH`;
}

// === Contribute to Campaign (Buy Items) ===
async function contribute(campaignId, pricePerUnit) {
  const quantityInput = document.getElementById(`buy-quantity-${campaignId}`);
  const costDisplay = document.getElementById(`buy-cost-${campaignId}`);
  const contributeBtn = quantityInput.closest('.space-y-2').querySelector('.btn-primary');

  // Получаем количество
  const quantity = parseInt(quantityInput.value) || 0;

  if (quantity <= 0) {
    showToast('Please enter a valid quantity!', 'error');
    return;
  }

  // Рассчитываем стоимость
  const totalCostEth = quantity * pricePerUnit;

  // Сохраняем оригинальный текст кнопки
  const originalBtnText = contributeBtn.innerHTML;
  let loadingToast = null;

  try {
    // UX: Показываем статус загрузки
    contributeBtn.innerHTML = '⏳ Processing...';
    contributeBtn.disabled = true;
    quantityInput.disabled = true;
    loadingToast = showToast('Processing purchase...', 'loading');

    // Конвертация ETH в Wei
    const amountWei = ethers.parseEther(totalCostEth.toFixed(18));

    console.log('🛒 Buying items:', {
      campaignId,
      quantity,
      pricePerUnit,
      totalCostEth,
      amountWei: amountWei.toString()
    });

    // Вызов контракта с отправкой ETH
    const tx = await crowdfundingContract.contribute(campaignId, {
      value: amountWei
    });

    // Ожидание подтверждения
    removeToast(loadingToast);
    loadingToast = showToast('Mining transaction...', 'loading');
    console.log('⏳ Waiting for transaction:', tx.hash);

    await tx.wait();

    removeToast(loadingToast);
    console.log('✅ Purchase successful!');
    showToast(`🎉 Bought ${quantity} items for ${totalCostEth.toFixed(4)} ETH!`, 'success');

    // Очистка полей
    quantityInput.value = '';
    costDisplay.textContent = '0.00 ETH';

    // Обновление списка кампаний и статов
    await loadCampaigns();
    await updateUserStats();

  } catch (error) {
    console.error('❌ Purchase failed:', error);
    if (loadingToast) removeToast(loadingToast);

    if (error.code === 'ACTION_REJECTED') {
      showToast('Transaction was rejected by user', 'error');
    } else if (error.reason) {
      showToast(`Error: ${error.reason}`, 'error');
    } else {
      showToast('Failed to buy items', 'error');
    }

    // Восстанавливаем кнопку при ошибке
    contributeBtn.innerHTML = originalBtnText;
    contributeBtn.disabled = false;
    quantityInput.disabled = false;
  }
}

// === Finalize Campaign ===
async function finalizeCampaign(campaignId) {
  const btn = event.target;
  const originalText = btn.innerHTML;
  let loadingToast = null;

  try {
    btn.innerHTML = '⏳ Processing...';
    btn.disabled = true;
    loadingToast = showToast('Finalizing campaign...', 'loading');

    console.log('✅ Finalizing campaign:', campaignId);

    const tx = await crowdfundingContract.finalizeCampaign(campaignId);

    removeToast(loadingToast);
    loadingToast = showToast('Mining transaction...', 'loading');
    console.log('⏳ Waiting for transaction:', tx.hash);

    await tx.wait();

    removeToast(loadingToast);
    console.log('✅ Campaign finalized!');
    showToast('🎉 Campaign finalized successfully!', 'success');

    // Обновление UI
    await loadCampaigns();
    await updateUserStats();

  } catch (error) {
    console.error('❌ Finalization failed:', error);
    if (loadingToast) removeToast(loadingToast);

    if (error.code === 'ACTION_REJECTED') {
      showToast('Transaction was rejected by user', 'error');
    } else if (error.reason) {
      showToast(`Error: ${error.reason}`, 'error');
    } else {
      showToast('Failed to finalize campaign', 'error');
    }

    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// === Withdraw Funds (For Campaign Owner) ===
async function withdrawFunds(campaignId) {
  const btn = event.target;
  const originalText = btn.innerHTML;
  let loadingToast = null;

  try {
    btn.innerHTML = '⏳ Processing...';
    btn.disabled = true;
    loadingToast = showToast('Withdrawing funds...', 'loading');

    console.log('💰 Withdrawing funds from campaign:', campaignId);

    // Вызываем finalizeCampaign который переводит средства владельцу
    const tx = await crowdfundingContract.finalizeCampaign(campaignId);

    removeToast(loadingToast);
    loadingToast = showToast('Mining transaction...', 'loading');
    console.log('⏳ Waiting for transaction:', tx.hash);

    await tx.wait();

    removeToast(loadingToast);
    console.log('✅ Funds withdrawn successfully!');
    showToast('🎉 Funds transferred to your wallet!', 'success');

    // Обновление UI
    await loadCampaigns();
    await updateUserStats();

  } catch (error) {
    console.error('❌ Withdrawal failed:', error);
    if (loadingToast) removeToast(loadingToast);

    if (error.code === 'ACTION_REJECTED') {
      showToast('Transaction was rejected by user', 'error');
    } else if (error.reason) {
      showToast(`Error: ${error.reason}`, 'error');
    } else {
      showToast('Failed to withdraw funds', 'error');
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
