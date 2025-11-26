import { ethers } from 'ethers';
import { query } from '../utils/database';
import { getProvider } from '../utils/ethersProvider';

export interface TBAResult {
  tbaAddress: string;
  transactionHash: string;
  blockNumber: number;
}

export interface PolicyModuleConfig {
  withdrawalRules: {
    maxDailyWithdrawal: string;
    maxMonthlyWithdrawal: string;
    kycRequired: boolean;
    voucherRequired: boolean;
  };
  extractionRoles: string[];
  stablecoinWhitelist: string[];
  projectRules: {
    projectId: string;
    withdrawalCap: string;
    allowedCurrencies: string[];
  };
}

export class TBAService {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Signer;
  private registryContract: ethers.Contract;
  private accountImpl: ethers.Contract;

  constructor() {
    if (!process.env.BASE_RPC_URL) {
      throw new Error('BASE_RPC_URL environment variable is required');
    }
    if (!process.env.PRIVATE_KEY) {
      throw new Error('PRIVATE_KEY environment variable is required');
    }
    if (!process.env.ERC6551_REGISTRY_ADDRESS) {
      throw new Error('ERC6551_REGISTRY_ADDRESS environment variable is required');
    }
    if (!process.env.ERC6551_ACCOUNT_IMPLEMENTATION) {
      throw new Error('ERC6551_ACCOUNT_IMPLEMENTATION environment variable is required');
    }
    if (!process.env.TITLE_NFT_ADDRESS) {
      throw new Error('TITLE_NFT_ADDRESS environment variable is required');
    }
    if (!process.env.POLICY_MODULE_ADDRESS) {
      throw new Error('POLICY_MODULE_ADDRESS environment variable is required');
    }

    this.provider = getProvider();
    this.signer = new ethers.Wallet(process.env.PRIVATE_KEY!, this.provider);

    // ERC-6551 Registry ABI
    const registryAbi = [
      "function createAccount(address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt, bytes calldata initData) external returns (address)",
      "event AccountCreated(address account, address implementation, uint256 chainId, address tokenContract, uint256 tokenId, uint256 salt)"
    ];

    // ERC-6551 Account Implementation ABI (simplified)
    const accountAbi = [
      "function initialize(address policyModule) external",
      "function execute(address to, uint256 value, bytes calldata data, uint8 operation) external payable returns (bytes memory)",
      "function owner() external view returns (address)",
      "function token() external view returns (uint256 chainId, address tokenContract, uint256 tokenId)"
    ];

    this.registryContract = new ethers.Contract(
      process.env.ERC6551_REGISTRY_ADDRESS,
      registryAbi,
      this.signer
    );

    this.accountImpl = new ethers.Contract(
      process.env.ERC6551_ACCOUNT_IMPLEMENTATION,
      accountAbi,
      this.signer
    );
  }

  async createTBA(tokenId: number, owner: string): Promise<TBAResult> {
    try {
      const chainId = 8453; // Base chain ID
      const tokenContract = process.env.TITLE_NFT_ADDRESS!;
      const salt = 0; // Default salt

      // PolicyModule initialization data (empty for now)
      const initData = "0x";

      console.log(`Creating TBA for token ${tokenId}...`);

      // Estimate gas for TBA creation
      const estimatedGas = await this.registryContract.createAccount.estimateGas(
        this.accountImpl.target,
        chainId,
        tokenContract,
        tokenId,
        salt,
        initData
      );

      const tx = await this.registryContract.createAccount(
        this.accountImpl.target,
        chainId,
        tokenContract,
        tokenId,
        salt,
        initData,
        {
          gasLimit: estimatedGas * BigInt(120) / BigInt(100), // 20% buffer
        }
      );

      console.log(`TBA creation transaction sent: ${tx.hash}`);
      const receipt = await tx.wait();

      // Parse TBA address from events
      const createEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.registryContract.interface.parseLog(log);
          return parsed?.name === 'AccountCreated';
        } catch {
          return false;
        }
      });

      if (!createEvent) {
        throw new Error('AccountCreated event not found in transaction receipt');
      }

      const parsedEvent = this.registryContract.interface.parseLog(createEvent);
      const tbaAddress = parsedEvent?.args?.account;

      // Update property with TBA address (idempotent operation)
      await query(
        'UPDATE properties SET tba_address = ? WHERE token_id = ? AND (tba_address IS NULL OR tba_address = ?)',
        [tbaAddress, tokenId, tbaAddress]
      );

      const result: TBAResult = {
        tbaAddress,
        transactionHash: receipt.hash,
        blockNumber: receipt.blockNumber,
      };

      console.log(`TBA created successfully: ${tbaAddress}`);
      return result;

    } catch (error) {
      console.error('TBA creation failed:', error);
      throw error;
    }
  }

  async initializePolicyModule(tbaAddress: string, config: PolicyModuleConfig): Promise<string> {
    try {
      // PolicyModule contract ABI (simplified)
      const policyAbi = [
        "function initialize(address tba, tuple(uint256 maxDailyWithdrawal, uint256 maxMonthlyWithdrawal, bool kycRequired, bool voucherRequired) withdrawalRules, address[] extractionRoles, address[] stablecoinWhitelist, tuple(string projectId, uint256 withdrawalCap, address[] allowedCurrencies) projectRules) external",
        "function setWithdrawalRules(tuple(uint256 maxDailyWithdrawal, uint256 maxMonthlyWithdrawal, bool kycRequired, bool voucherRequired) rules) external",
        "function addExtractionRole(address role) external",
        "function addStablecoin(address token) external",
        "function setProjectRules(tuple(string projectId, uint256 withdrawalCap, address[] allowedCurrencies) rules) external"
      ];

      const policyContract = new ethers.Contract(
        process.env.POLICY_MODULE_ADDRESS!,
        policyAbi,
        this.signer
      );

      console.log(`Initializing PolicyModule for TBA ${tbaAddress}...`);

      // Convert config to contract parameters
      const withdrawalRules = [
        ethers.parseEther(config.withdrawalRules.maxDailyWithdrawal),
        ethers.parseEther(config.withdrawalRules.maxMonthlyWithdrawal),
        config.withdrawalRules.kycRequired,
        config.withdrawalRules.voucherRequired
      ];

      const projectRules = [
        config.projectRules.projectId,
        ethers.parseEther(config.projectRules.withdrawalCap),
        config.projectRules.allowedCurrencies
      ];

      // Estimate gas for PolicyModule initialization
      const estimatedGas = await policyContract.initialize.estimateGas(
        tbaAddress,
        withdrawalRules,
        config.extractionRoles,
        config.stablecoinWhitelist,
        projectRules
      );

      const tx = await policyContract.initialize(
        tbaAddress,
        withdrawalRules,
        config.extractionRoles,
        config.stablecoinWhitelist,
        projectRules,
        {
          gasLimit: estimatedGas * BigInt(120) / BigInt(100), // 20% buffer
        }
      );

      const receipt = await tx.wait();
      console.log(`PolicyModule initialized: ${receipt.hash}`);

      return receipt.hash;

    } catch (error) {
      console.error('PolicyModule initialization failed:', error);
      throw error;
    }
  }

  async getTBABalance(tbaAddress: string, tokenAddress: string): Promise<string> {
    try {
      const erc20Abi = [
        "function balanceOf(address account) external view returns (uint256)"
      ];

      const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);
      const balance = await tokenContract.balanceOf(tbaAddress);

      return ethers.formatEther(balance);
    } catch (error) {
      console.error('Failed to get TBA balance:', error);
      throw error;
    }
  }

  async generateWithdrawalVoucher(
    tbaAddress: string,
    recipient: string,
    amount: string,
    tokenAddress: string
  ): Promise<{ voucher: string; signature: string }> {
    try {
      // Verify TBA ownership and KYC status
      const property = await query(
        'SELECT p.id, u.kyc_verified FROM properties p JOIN users u ON p.user_id = u.id WHERE p.tba_address = ?',
        [tbaAddress]
      );

      if (!property || property.length === 0) {
        throw new Error('TBA not found or not associated with a property');
      }

      if (!property[0].kyc_verified) {
        throw new Error('KYC verification required for withdrawals');
      }

      const voucherData = {
        tbaAddress,
        recipient,
        amount: ethers.parseEther(amount),
        tokenAddress,
        timestamp: Math.floor(Date.now() / 1000),
        nonce: Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
      };

      // Create voucher hash
      const voucherHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'uint256', 'address', 'uint256', 'string'],
          [
            voucherData.tbaAddress,
            voucherData.recipient,
            voucherData.amount,
            voucherData.tokenAddress,
            voucherData.timestamp,
            voucherData.nonce
          ]
        )
      );

      // Sign the voucher
      const signature = await this.signer.signMessage(ethers.getBytes(voucherHash));

      return {
        voucher: JSON.stringify(voucherData),
        signature
      };

    } catch (error) {
      console.error('Voucher generation failed:', error);
      throw error;
    }
  }

  async executeWithdrawal(
    tbaAddress: string,
    voucher: string,
    signature: string
  ): Promise<string> {
    try {
      const voucherData = JSON.parse(voucher);

      // Verify voucher hasn't expired (24 hours)
      const voucherAge = Math.floor(Date.now() / 1000) - voucherData.timestamp;
      if (voucherAge > 86400) { // 24 hours
        throw new Error('Voucher has expired');
      }

      // Verify signature
      const voucherHash = ethers.keccak256(
        ethers.AbiCoder.defaultAbiCoder().encode(
          ['address', 'address', 'uint256', 'address', 'uint256', 'string'],
          [
            voucherData.tbaAddress,
            voucherData.recipient,
            voucherData.amount,
            voucherData.tokenAddress,
            voucherData.timestamp,
            voucherData.nonce
          ]
        )
      );

      const recoveredAddress = ethers.recoverAddress(voucherHash, signature);
      if (recoveredAddress.toLowerCase() !== (await this.signer.getAddress()).toLowerCase()) {
        throw new Error('Invalid voucher signature');
      }

      // Check if voucher has already been used (store in database)
      const existingTx = await query(
        'SELECT id FROM distributions WHERE distribution_data LIKE ? AND status = "EXECUTED"',
        [`%${voucherData.nonce}%`]
      );

      if (existingTx && existingTx.length > 0) {
        throw new Error('Voucher has already been used');
      }

      // TBA contract call to execute withdrawal
      const tbaContract = new ethers.Contract(tbaAddress, [
        "function executeWithdrawal(bytes voucher, bytes signature) external"
      ], this.signer);

      // Estimate gas for withdrawal
      const estimatedGas = await tbaContract.executeWithdrawal.estimateGas(voucher, signature);

      const tx = await tbaContract.executeWithdrawal(
        voucher,
        signature,
        {
          gasLimit: estimatedGas * BigInt(120) / BigInt(100), // 20% buffer
        }
      );
      const receipt = await tx.wait();

      console.log(`Withdrawal executed: ${receipt.hash}`);
      return receipt.hash;

    } catch (error) {
      console.error('Withdrawal execution failed:', error);
      throw error;
    }
  }
}

export const tbaService = new TBAService();