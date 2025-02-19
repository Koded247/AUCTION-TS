// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract ReverseDutchAuctionSwap {
    struct Auction {
        address seller;
        IERC20 token;
        uint256 initialPrice;
        uint256 startTime;
        uint256 duration;
        uint256 decayRate;
        uint256 amount;
        bool active;
    }
    
    mapping(uint256 => Auction) public auctions;
    uint256 public auctionCount = 0;

    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address token,
        uint256 initialPrice,
        uint256 duration,
        uint256 decayRate,
        uint256 amount
    );
    event AuctionFinalized(
        uint256 indexed auctionId,
        address indexed buyer,
        uint256 finalPrice
    );
    event AuctionCancelled(uint256 indexed auctionId);

    function createAuction(
        address token,
        uint256 initialPrice,
        uint256 duration,
        uint256 decayRate,
        uint256 amount
    ) external returns (uint256) {
        if (initialPrice <= 0) {
            revert("Invalid initial price");
        } else if (duration <= 0) {
            revert("Invalid duration");
        } else if (decayRate <= 0) {
            revert("Invalid decay rate");
        } else if (amount <= 0) {
            revert("Invalid amount");
        } else if (initialPrice <= duration * decayRate) {
            revert("Price would reach zero");
        } else {
            IERC20(token).transferFrom(msg.sender, address(this), amount);
            
            uint256 auctionId = auctionCount++;
            auctions[auctionId] = Auction({
                seller: msg.sender,
                token: IERC20(token),
                initialPrice: initialPrice,
                startTime: block.timestamp,
                duration: duration,
                decayRate: decayRate,
                amount: amount,
                active: true
            });

            emit AuctionCreated(
                auctionId,
                msg.sender,
                token,
                initialPrice,
                duration,
                decayRate,
                amount
            );

            return auctionId;
        }
    }

    function getCurrentPrice(uint256 auctionId) public view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        
        if (!auction.active) {
            revert("Auction not active");
        } else {
            uint256 elapsedTime = block.timestamp - auction.startTime;
            if (elapsedTime >= auction.duration) {
                return 0;
            }
            
            uint256 priceDrop = elapsedTime * auction.decayRate;
            if (priceDrop >= auction.initialPrice) {
                return 0;
            }
            
            return auction.initialPrice - priceDrop;
        }
    }

    function buy(uint256 auctionId) external payable {
        Auction storage auction = auctions[auctionId];
        
        if (!auction.active) {
            revert("Auction not active");
        } else {
            uint256 currentPrice = getCurrentPrice(auctionId);
            
            if (currentPrice <= 0) {
                revert("Auction expired");
            } else if (msg.value < currentPrice) {
                revert("Insufficient payment");
            } else {
                auction.active = false;
                auction.token.transfer(msg.sender, auction.amount);
                payable(auction.seller).transfer(currentPrice);
                
                if (msg.value > currentPrice) {
                    payable(msg.sender).transfer(msg.value - currentPrice);
                }

                emit AuctionFinalized(auctionId, msg.sender, currentPrice);
            }
        }
    }

    function cancelAuction(uint256 auctionId) external {
        Auction storage auction = auctions[auctionId];
        
        if (msg.sender != auction.seller) {
            revert("Not seller");
        } else if (!auction.active) {
            revert("Auction not active");
        } else {
            auction.active = false;
            auction.token.transfer(auction.seller, auction.amount);

            emit AuctionCancelled(auctionId);
        }
    }
}