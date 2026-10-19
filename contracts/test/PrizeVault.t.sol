// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {PrizeVault} from "../PrizeVault.sol";

// ---------------------------------------------------------------------------
// MockUSDC — minimal ERC-20 with mint + blocklist.
// Deployed at a throwaway address then etched to the canonical USDC constant.
// ---------------------------------------------------------------------------
contract MockUSDC {
    string public name     = "Mock USDC";
    string public symbol   = "mUSDC";
    uint8  public decimals = 6;

    mapping(address => uint256) private _balances;
    mapping(address => mapping(address => uint256)) private _allowances;
    mapping(address => bool) private _blocklisted;
    uint256 public totalSupply;

    // ---- admin helpers ----
    function mint(address to, uint256 amount) external {
        _balances[to] += amount;
        totalSupply    += amount;
    }

    /// @notice Toggle blocklist status for an address.
    function blocklist(address account) external {
        _blocklisted[account] = !_blocklisted[account];
    }

    function isBlocklisted(address account) external view returns (bool) {
        return _blocklisted[account];
    }

    // ---- ERC-20 surface ----
    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (_blocklisted[msg.sender] || _blocklisted[to]) return false;
        if (_balances[msg.sender] < amount) return false;
        _balances[msg.sender] -= amount;
        _balances[to]         += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (_blocklisted[from] || _blocklisted[to]) return false;
        if (_balances[from] < amount) return false;
        if (_allowances[from][msg.sender] < amount) return false;
        _allowances[from][msg.sender] -= amount;
        _balances[from]               -= amount;
        _balances[to]                 += amount;
        return true;
    }
}

// ---------------------------------------------------------------------------
// Test contract
// ---------------------------------------------------------------------------
contract PrizeVaultTest is Test {
    // Canonical USDC address hard-coded in PrizeVault
    address internal constant USDC_ADDR = 0x3600000000000000000000000000000000000000;

    PrizeVault internal vault;
    MockUSDC   internal mockUSDC;

    address internal organizer = makeAddr("organizer");
    address internal winner1   = makeAddr("winner1");
    address internal winner2   = makeAddr("winner2");
    address internal stranger  = makeAddr("stranger");

    // Convenience helpers
    uint256 internal constant DEPOSIT_AMT = 1_000e6; // 1 000 USDC
    uint64  internal constant ONE_DAY     = 1 days;

    // -----------------------------------------------------------------------
    // setUp — runs before EVERY test
    // -----------------------------------------------------------------------
    function setUp() public {
        // 1. Deploy mock to a throwaway address.
        MockUSDC temp = new MockUSDC();

        // 2. Etch runtime bytecode onto the canonical USDC address.
        vm.etch(USDC_ADDR, address(temp).code);

        // 3. Bind a typed handle to the canonical address.
        mockUSDC = MockUSDC(USDC_ADDR);

        // 4. Seed the organizer's USDC balance and approval.
        mockUSDC.mint(organizer, 10_000_000e6); // 10 M USDC

        // 5. Deploy the contract under test.
        vault = new PrizeVault();

        // 6. Pre-approve PrizeVault to pull from organizer.
        vm.prank(organizer);
        mockUSDC.approve(address(vault), type(uint256).max);
    }

    // -----------------------------------------------------------------------
    // Internal helpers
    // -----------------------------------------------------------------------

    /// Create a vault with deadline = now + 1 day and return its id.
    function _createVault() internal returns (uint256 vaultId) {
        vm.prank(organizer);
        vaultId = vault.createVault("Test Prize", uint64(block.timestamp + ONE_DAY));
    }

    /// Create + deposit DEPOSIT_AMT.
    function _createAndDeposit() internal returns (uint256 vaultId) {
        vaultId = _createVault();
        vm.prank(organizer);
        vault.deposit(vaultId, DEPOSIT_AMT);
    }

    // -----------------------------------------------------------------------
    // 1. test_createVault_basic
    // -----------------------------------------------------------------------
    function test_createVault_basic() public {
        uint64 deadline = uint64(block.timestamp + ONE_DAY);

        vm.prank(organizer);
        uint256 vaultId = vault.createVault("My Prize", deadline);

        assertEq(vaultId, 0, "first vaultId should be 0");

        (address org, string memory title, uint64 dl, uint256 dep, uint256 awd, bool refunded) =
            vault.getVault(vaultId);

        assertEq(org,      organizer,    "organizer mismatch");
        assertEq(title,    "My Prize",   "title mismatch");
        assertEq(dl,       deadline,     "deadline mismatch");
        assertEq(dep,      0,            "deposited should be 0");
        assertEq(awd,      0,            "awarded should be 0");
        assertFalse(refunded,            "refunded should be false");
    }

    // -----------------------------------------------------------------------
    // 2. test_createVault_deadline_too_soon
    // -----------------------------------------------------------------------
    function test_createVault_deadline_too_soon() public {
        // deadline == block.timestamp  → <= nowTs → DeadlineInvalid
        vm.prank(organizer);
        vm.expectRevert(PrizeVault.DeadlineInvalid.selector);
        vault.createVault("Bad", uint64(block.timestamp));
    }

    // -----------------------------------------------------------------------
    // 3. test_createVault_deadline_too_far
    // -----------------------------------------------------------------------
    function test_createVault_deadline_too_far() public {
        // deadline == now + 365 days + 1 second → > nowTs + 365 days → DeadlineInvalid
        vm.prank(organizer);
        vm.expectRevert(PrizeVault.DeadlineInvalid.selector);
        vault.createVault("Bad", uint64(block.timestamp + 365 days + 1));
    }

    // -----------------------------------------------------------------------
    // 4. test_deposit_basic
    // -----------------------------------------------------------------------
    function test_deposit_basic() public {
        uint256 vaultId = _createVault();

        uint256 orgBalBefore    = mockUSDC.balanceOf(organizer);
        uint256 vaultBalBefore  = mockUSDC.balanceOf(address(vault));

        vm.prank(organizer);
        vault.deposit(vaultId, DEPOSIT_AMT);

        (, , , uint256 deposited, , ) = vault.getVault(vaultId);
        assertEq(deposited, DEPOSIT_AMT, "vault.deposited mismatch");

        assertEq(mockUSDC.balanceOf(organizer),      orgBalBefore  - DEPOSIT_AMT, "organizer USDC not pulled");
        assertEq(mockUSDC.balanceOf(address(vault)), vaultBalBefore + DEPOSIT_AMT, "vault USDC not increased");
    }

    // -----------------------------------------------------------------------
    // 5. test_deposit_not_organizer
    // -----------------------------------------------------------------------
    function test_deposit_not_organizer() public {
        uint256 vaultId = _createVault();

        // Give stranger some USDC + approval so the transfer would succeed if not for the guard
        mockUSDC.mint(stranger, DEPOSIT_AMT);
        vm.prank(stranger);
        mockUSDC.approve(address(vault), type(uint256).max);

        vm.prank(stranger);
        vm.expectRevert(PrizeVault.NotOrganizer.selector);
        vault.deposit(vaultId, DEPOSIT_AMT);
    }

    // -----------------------------------------------------------------------
    // 6. test_deposit_after_deadline
    // -----------------------------------------------------------------------
    function test_deposit_after_deadline() public {
        uint256 vaultId = _createVault();
        (, , uint64 dl, , , ) = vault.getVault(vaultId);

        // Warp strictly past deadline
        vm.warp(uint256(dl) + 1);

        vm.prank(organizer);
        vm.expectRevert(PrizeVault.DeadlinePassed.selector);
        vault.deposit(vaultId, DEPOSIT_AMT);
    }

    // -----------------------------------------------------------------------
    // 7. test_deposit_at_deadline
    //    deposit checks block.timestamp >= awardDeadline → reverts at equality
    // -----------------------------------------------------------------------
    function test_deposit_at_deadline() public {
        uint256 vaultId = _createVault();
        (, , uint64 dl, , , ) = vault.getVault(vaultId);

        vm.warp(uint256(dl)); // exactly at deadline

        vm.prank(organizer);
        vm.expectRevert(PrizeVault.DeadlinePassed.selector);
        vault.deposit(vaultId, DEPOSIT_AMT);
    }

    // -----------------------------------------------------------------------
    // 8. test_award_basic
    // -----------------------------------------------------------------------
    function test_award_basic() public {
        uint256 vaultId = _createAndDeposit();

        vm.prank(organizer);
        vault.award(vaultId, winner1, DEPOSIT_AMT);

        assertEq(vault.claimable(vaultId, winner1), DEPOSIT_AMT, "claimable mismatch");
    }

    // -----------------------------------------------------------------------
    // 9. test_award_not_organizer
    // -----------------------------------------------------------------------
    function test_award_not_organizer() public {
        uint256 vaultId = _createAndDeposit();

        vm.prank(stranger);
        vm.expectRevert(PrizeVault.NotOrganizer.selector);
        vault.award(vaultId, winner1, DEPOSIT_AMT);
    }

    // -----------------------------------------------------------------------
    // 10. test_award_after_deadline
    // -----------------------------------------------------------------------
    function test_award_after_deadline() public {
        uint256 vaultId = _createAndDeposit();
        (, , uint64 dl, , , ) = vault.getVault(vaultId);

        vm.warp(uint256(dl) + 1);

        vm.prank(organizer);
        vm.expectRevert(PrizeVault.DeadlinePassed.selector);
        vault.award(vaultId, winner1, DEPOSIT_AMT);
    }

    // -----------------------------------------------------------------------
    // 11. test_award_exceeds_deposited
    // -----------------------------------------------------------------------
    function test_award_exceeds_deposited() public {
        uint256 vaultId = _createAndDeposit();

        vm.prank(organizer);
        vm.expectRevert(PrizeVault.InsufficientVaultBalance.selector);
        vault.award(vaultId, winner1, DEPOSIT_AMT + 1);
    }

    // -----------------------------------------------------------------------
    // 12. test_award_multiple_winners_within_deposited
    // -----------------------------------------------------------------------
    function test_award_multiple_winners_within_deposited() public {
        uint256 vaultId = _createAndDeposit();

        uint256 half = DEPOSIT_AMT / 2;

        vm.prank(organizer);
        vault.award(vaultId, winner1, half);

        vm.prank(organizer);
        vault.award(vaultId, winner2, DEPOSIT_AMT - half);

        (, , , , uint256 awarded, ) = vault.getVault(vaultId);
        assertEq(awarded, DEPOSIT_AMT, "total awarded should equal deposited");
    }

    // -----------------------------------------------------------------------
    // 13. test_award_over_sum_fails
    // -----------------------------------------------------------------------
    function test_award_over_sum_fails() public {
        uint256 vaultId = _createAndDeposit();

        // Award winner1 half the deposit
        uint256 half = DEPOSIT_AMT / 2;
        vm.prank(organizer);
        vault.award(vaultId, winner1, half);

        // Award winner2 the remaining half — vault.awarded now == DEPOSIT_AMT
        vm.prank(organizer);
        vault.award(vaultId, winner2, DEPOSIT_AMT - half);

        // Any further award (even 1 wei) must revert — nothing left in vault
        vm.prank(organizer);
        vm.expectRevert(PrizeVault.InsufficientVaultBalance.selector);
        vault.award(vaultId, stranger, 1);
    }

    // -----------------------------------------------------------------------
    // 14. test_claim_basic
    // -----------------------------------------------------------------------
    function test_claim_basic() public {
        uint256 vaultId = _createAndDeposit();

        vm.prank(organizer);
        vault.award(vaultId, winner1, DEPOSIT_AMT);

        uint256 winnerBalBefore = mockUSDC.balanceOf(winner1);

        vm.prank(winner1);
        vault.claim(vaultId);

        assertEq(mockUSDC.balanceOf(winner1), winnerBalBefore + DEPOSIT_AMT, "winner balance not increased");
        assertEq(vault.claimable(vaultId, winner1), 0, "claimable not zeroed");
    }

    // -----------------------------------------------------------------------
    // 15. test_double_claim_fails
    // -----------------------------------------------------------------------
    function test_double_claim_fails() public {
        uint256 vaultId = _createAndDeposit();

        vm.prank(organizer);
        vault.award(vaultId, winner1, DEPOSIT_AMT);

        vm.prank(winner1);
        vault.claim(vaultId);

        vm.prank(winner1);
        vm.expectRevert(PrizeVault.NothingToClaim.selector);
        vault.claim(vaultId);
    }

    // -----------------------------------------------------------------------
    // 16. test_claim_after_deadline — winner can STILL claim post-deadline
    // -----------------------------------------------------------------------
    function test_claim_after_deadline() public {
        uint256 vaultId = _createAndDeposit();

        vm.prank(organizer);
        vault.award(vaultId, winner1, DEPOSIT_AMT);

        (, , uint64 dl, , , ) = vault.getVault(vaultId);
        vm.warp(uint256(dl) + 1);

        // claim has no deadline guard — should succeed
        vm.prank(winner1);
        vault.claim(vaultId);

        assertEq(vault.claimable(vaultId, winner1), 0, "claimable should be 0 after claim");
        assertEq(mockUSDC.balanceOf(winner1), DEPOSIT_AMT, "winner should have received USDC");
    }

    // -----------------------------------------------------------------------
    // 17. test_refund_basic
    // -----------------------------------------------------------------------
    function test_refund_basic() public {
        uint256 vaultId = _createAndDeposit();

        // Award only half
        vm.prank(organizer);
        vault.award(vaultId, winner1, DEPOSIT_AMT / 2);

        (, , uint64 dl, , , ) = vault.getVault(vaultId);
        vm.warp(uint256(dl));  // exactly at deadline → refund succeeds (< becomes false)

        uint256 orgBalBefore = mockUSDC.balanceOf(organizer);

        vm.prank(organizer);
        vault.refund(vaultId);

        uint256 expectedRefund = DEPOSIT_AMT - DEPOSIT_AMT / 2;
        assertEq(mockUSDC.balanceOf(organizer), orgBalBefore + expectedRefund, "organizer refund amount wrong");

        (, , , , , bool refunded) = vault.getVault(vaultId);
        assertTrue(refunded, "vault should be marked refunded");
    }

    // -----------------------------------------------------------------------
    // 18. test_refund_before_deadline
    // -----------------------------------------------------------------------
    function test_refund_before_deadline() public {
        uint256 vaultId = _createAndDeposit();

        vm.prank(organizer);
        vm.expectRevert(PrizeVault.DeadlineNotPassed.selector);
        vault.refund(vaultId);
    }

    // -----------------------------------------------------------------------
    // 19. test_refund_at_deadline
    //    refund checks block.timestamp < awardDeadline → at equality the check
    //    is false, so refund SUCCEEDS.
    // -----------------------------------------------------------------------
    function test_refund_at_deadline() public {
        uint256 vaultId = _createAndDeposit();
        (, , uint64 dl, , , ) = vault.getVault(vaultId);

        vm.warp(uint256(dl)); // exactly == awardDeadline

        vm.prank(organizer);
        // No award made → full deposit is refunded
        vault.refund(vaultId);

        (, , , , , bool refunded) = vault.getVault(vaultId);
        assertTrue(refunded, "vault should be marked refunded at-deadline");
    }

    // -----------------------------------------------------------------------
    // 20. test_refund_double
    // -----------------------------------------------------------------------
    function test_refund_double() public {
        uint256 vaultId = _createAndDeposit();
        (, , uint64 dl, , , ) = vault.getVault(vaultId);

        vm.warp(uint256(dl));

        vm.prank(organizer);
        vault.refund(vaultId);

        vm.prank(organizer);
        vm.expectRevert(PrizeVault.AlreadyRefunded.selector);
        vault.refund(vaultId);
    }

    // -----------------------------------------------------------------------
    // 21. test_refund_after_full_award
    //    All deposited is awarded → refundAmount == 0 → ZeroAmount revert
    // -----------------------------------------------------------------------
    function test_refund_after_full_award() public {
        uint256 vaultId = _createAndDeposit();

        vm.prank(organizer);
        vault.award(vaultId, winner1, DEPOSIT_AMT);

        (, , uint64 dl, , , ) = vault.getVault(vaultId);
        vm.warp(uint256(dl));

        vm.prank(organizer);
        vm.expectRevert(PrizeVault.ZeroAmount.selector);
        vault.refund(vaultId);
    }

    // -----------------------------------------------------------------------
    // 22. test_winner_claims_after_organizer_refunds
    // -----------------------------------------------------------------------
    function test_winner_claims_after_organizer_refunds() public {
        uint256 vaultId = _createAndDeposit();

        uint256 winnerShare = DEPOSIT_AMT / 2;
        vm.prank(organizer);
        vault.award(vaultId, winner1, winnerShare);

        (, , uint64 dl, , , ) = vault.getVault(vaultId);
        vm.warp(uint256(dl));

        vm.prank(organizer);
        vault.refund(vaultId);

        // Winner can still claim their portion
        vm.prank(winner1);
        vault.claim(vaultId);

        assertEq(mockUSDC.balanceOf(winner1), winnerShare, "winner should receive their share");
        assertEq(vault.claimable(vaultId, winner1), 0, "claimable should be 0 after claim");
    }

    // -----------------------------------------------------------------------
    // 23. test_non_organizer_cannot_refund
    // -----------------------------------------------------------------------
    function test_non_organizer_cannot_refund() public {
        uint256 vaultId = _createAndDeposit();
        (, , uint64 dl, , , ) = vault.getVault(vaultId);

        vm.warp(uint256(dl));

        vm.prank(stranger);
        vm.expectRevert(PrizeVault.NotOrganizer.selector);
        vault.refund(vaultId);
    }

    // -----------------------------------------------------------------------
    // 24. test_claim_blocklisted_winner
    //    The claim() function zeros claimable BEFORE calling transfer (CEI).
    //    If transfer returns false, the entire tx reverts (including the storage
    //    write), so claimable is restored to its original value.
    // -----------------------------------------------------------------------
    function test_claim_blocklisted_winner() public {
        uint256 vaultId = _createAndDeposit();

        vm.prank(organizer);
        vault.award(vaultId, winner1, DEPOSIT_AMT);

        uint256 claimableBefore = vault.claimable(vaultId, winner1);

        // Blocklist winner1 so transfer returns false
        mockUSDC.blocklist(winner1);

        vm.prank(winner1);
        vm.expectRevert(PrizeVault.TransferFailed.selector);
        vault.claim(vaultId);

        // Because the entire tx reverted, the storage write to _claimable was
        // also rolled back → claimable is still the original amount.
        assertEq(vault.claimable(vaultId, winner1), claimableBefore, "claimable should be restored after revert");
    }

    // -----------------------------------------------------------------------
    // 25. test_getVault_not_found
    // -----------------------------------------------------------------------
    function test_getVault_not_found() public {
        vm.expectRevert(PrizeVault.VaultNotFound.selector);
        vault.getVault(9999);
    }

    // -----------------------------------------------------------------------
    // 26. testFuzz_accounting_invariant
    // -----------------------------------------------------------------------
    function testFuzz_accounting_invariant(
        uint96 depositAmt,
        uint96 awardAmt1,
        uint96 awardAmt2
    ) public {
        // ---- bound inputs ----
        depositAmt = uint96(bound(uint256(depositAmt), 1, 1_000_000e6));
        // winner1 gets at most half of the deposit
        awardAmt1  = uint96(bound(uint256(awardAmt1), 0, uint256(depositAmt) / 2));
        // winner2 gets whatever is left after winner1
        awardAmt2  = uint96(bound(uint256(awardAmt2), 0, uint256(depositAmt) - uint256(awardAmt1)));

        // ---- setup ----
        // Ensure organizer has enough USDC (setUp gives 10M but depositAmt can exceed
        // that in theory at max bound; mint more just in case)
        mockUSDC.mint(organizer, depositAmt);

        uint256 vaultId = _createVault();

        vm.prank(organizer);
        vault.deposit(vaultId, depositAmt);

        // ---- award ----
        if (awardAmt1 > 0) {
            vm.prank(organizer);
            vault.award(vaultId, winner1, awardAmt1);
        }
        if (awardAmt2 > 0) {
            vm.prank(organizer);
            vault.award(vaultId, winner2, awardAmt2);
        }

        // ---- invariant: deposited >= awarded ----
        (, , , uint256 deposited, uint256 awarded, ) = vault.getVault(vaultId);
        assertGe(deposited, awarded, "invariant: deposited >= awarded violated");

        // ---- winner1 claims ----
        if (awardAmt1 > 0) {
            vm.prank(winner1);
            vault.claim(vaultId);
            assertEq(
                mockUSDC.balanceOf(address(vault)),
                depositAmt - awardAmt1,
                "vault balance after winner1 claim"
            );
        }

        // ---- warp past deadline & organizer refunds ----
        (, , uint64 dl, , , ) = vault.getVault(vaultId);
        vm.warp(uint256(dl));  // exactly at deadline → refund succeeds

        uint256 orgBalBefore = mockUSDC.balanceOf(organizer);
        uint256 refundAmount = depositAmt - awarded; // deposited - awarded

        if (refundAmount > 0) {
            vm.prank(organizer);
            vault.refund(vaultId);
        }

        // ---- final assertions ----
        // vault should hold only the unclaimed award for winner2
        assertEq(
            mockUSDC.balanceOf(address(vault)),
            awardAmt2,
            "vault final balance should equal awardAmt2 (unclaimed for winner2)"
        );

        // organizer received at least the refund amount
        if (refundAmount > 0) {
            assertGe(
                mockUSDC.balanceOf(organizer),
                orgBalBefore + refundAmount,
                "organizer should have received at least refundAmount"
            );
        }
    }
}
