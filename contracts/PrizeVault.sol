// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface used by this vault.
interface IERC20 {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title PrizeVault
/// @notice Organizer-funded prize vaults using USDC only.
/// @dev No admin keys, no fees, no native token accounting.
contract PrizeVault {
    /// @notice Arc USDC token (6 decimals).
    address public constant USDC = 0x3600000000000000000000000000000000000000;

    error VaultNotFound();
    error NotOrganizer();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error DeadlineInvalid();
    error ZeroAmount();
    error InsufficientVaultBalance();
    error NothingToClaim();
    error AlreadyRefunded();
    error ZeroAddress();
    error TransferFailed();
    error ReentrantCall();

    event VaultCreated(uint256 indexed vaultId, address indexed organizer, string title, uint64 awardDeadline);
    event Deposited(uint256 indexed vaultId, address indexed depositor, uint256 amount);
    event Awarded(uint256 indexed vaultId, address indexed winner, uint256 amount);
    event Claimed(uint256 indexed vaultId, address indexed winner, uint256 amount);
    event Refunded(uint256 indexed vaultId, address indexed organizer, uint256 amount);

    struct Vault {
        address organizer;
        string title;
        uint64 awardDeadline;
        uint256 deposited;
        uint256 awarded;
        bool refunded;
    }

    mapping(uint256 => Vault) private _vaults;
    mapping(uint256 => mapping(address => uint256)) private _claimable;
    uint256 private _nextVaultId;

    // Simple non-reentrancy flag (0 = unlocked, 1 = locked).
    uint8 private _entered;

    modifier nonReentrant() {
        if (_entered == 1) revert ReentrantCall();
        _entered = 1;
        _;
        _entered = 0;
    }

    /// @notice Create a new prize vault.
    function createVault(string calldata title, uint64 awardDeadline) external returns (uint256 vaultId) {
        uint256 nowTs = block.timestamp;
        if (awardDeadline <= nowTs || awardDeadline > nowTs + 365 days) revert DeadlineInvalid();

        vaultId = _nextVaultId++;
        _vaults[vaultId] = Vault({
            organizer: msg.sender,
            title: title,
            awardDeadline: awardDeadline,
            deposited: 0,
            awarded: 0,
            refunded: false
        });

        emit VaultCreated(vaultId, msg.sender, title, awardDeadline);
    }

    /// @notice Deposit USDC into a vault before its deadline.
    function deposit(uint256 vaultId, uint256 amount) external nonReentrant {
        Vault storage vault = _getVault(vaultId);

        if (msg.sender != vault.organizer) revert NotOrganizer();
        if (block.timestamp >= vault.awardDeadline) revert DeadlinePassed();
        if (amount == 0) revert ZeroAmount();

        bool ok = IERC20(USDC).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        vault.deposited += amount;
        emit Deposited(vaultId, msg.sender, amount);
    }

    /// @notice Allocate claimable USDC to a winner before deadline.
    function award(uint256 vaultId, address winner, uint256 amount) external {
        Vault storage vault = _getVault(vaultId);

        if (msg.sender != vault.organizer) revert NotOrganizer();
        if (block.timestamp >= vault.awardDeadline) revert DeadlinePassed();
        if (winner == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        if (vault.awarded + amount > vault.deposited) revert InsufficientVaultBalance();

        vault.awarded += amount;
        _claimable[vaultId][winner] += amount;

        emit Awarded(vaultId, winner, amount);
    }

    /// @notice Claim allocated USDC from a vault.
    /// @dev Winners whose address is on the USDC blocklist will find this reverts
    ///      until they are removed from the blocklist; their claimable balance is
    ///      preserved and they can claim again once unblocked.
    function claim(uint256 vaultId) external nonReentrant {
        _getVault(vaultId);

        uint256 amount = _claimable[vaultId][msg.sender];
        if (amount == 0) revert NothingToClaim();

        // Effects before interaction: zero out before transfer to prevent re-entrancy.
        _claimable[vaultId][msg.sender] = 0;

        bool ok = IERC20(USDC).transfer(msg.sender, amount);
        if (!ok) revert TransferFailed();

        emit Claimed(vaultId, msg.sender, amount);
    }

    /// @notice Refund any unawarded USDC to the organizer at or after the deadline.
    /// @dev Awarded-but-unclaimed funds are NOT included: winners retain their
    ///      claimable balance indefinitely even after this call.
    ///      If the organizer's address is on the USDC blocklist this will revert.
    function refund(uint256 vaultId) external nonReentrant {
        Vault storage vault = _getVault(vaultId);

        if (msg.sender != vault.organizer) revert NotOrganizer();
        if (block.timestamp < vault.awardDeadline) revert DeadlineNotPassed();
        if (vault.refunded) revert AlreadyRefunded();

        uint256 refundAmount = vault.deposited - vault.awarded;
        if (refundAmount == 0) revert ZeroAmount();

        // Mark refunded before transfer; revert rolls back on failure.
        vault.refunded = true;

        if (vault.organizer == address(0)) revert ZeroAddress();
        bool ok = IERC20(USDC).transfer(vault.organizer, refundAmount);
        if (!ok) revert TransferFailed();

        emit Refunded(vaultId, msg.sender, refundAmount);
    }

    /// @notice Return vault details.
    function getVault(
        uint256 vaultId
    )
        external
        view
        returns (
            address organizer,
            string memory title,
            uint64 awardDeadline,
            uint256 deposited,
            uint256 awarded,
            bool refunded
        )
    {
        Vault storage vault = _getVault(vaultId);
        return (vault.organizer, vault.title, vault.awardDeadline, vault.deposited, vault.awarded, vault.refunded);
    }

    /// @notice Return currently claimable amount for a winner in a vault.
    function claimable(uint256 vaultId, address winner) external view returns (uint256) {
        return _claimable[vaultId][winner];
    }

    /// @dev Internal helper: reverts if vault does not exist.
    function _getVault(uint256 vaultId) internal view returns (Vault storage vault) {
        vault = _vaults[vaultId];
        if (vault.organizer == address(0)) revert VaultNotFound();
    }
}
