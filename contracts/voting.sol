// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DecentralizedVoting {
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount;
        string imageCID; 
        bool active;      
    }

    struct VoteRecord {
        address voter;
        uint256 candidateId;
        uint256 timestamp;
        uint256 round;
    }

    address public admin;
    uint256 public candidatesCount;
    uint256 public startTime;
    uint256 public endTime;
    bool public electionStarted;
    uint256 public electionRound;
    
    // --- CHỨC NĂNG MỚI: GIỚI HẠN PHIẾU BẦU ---
    uint256 public maxVotesPerVoter; 
    mapping(address => mapping(uint256 => uint256)) public votesUsedInRound; // voter => round => số phiếu đã dùng

    // --- QUẢN LÝ WHITELIST ---
    bool public isPrivate = false; 
    mapping(address => bool) public whitelist;
    address[] public whitelistAddresses; 

    mapping(uint256 => Candidate) public candidates;
    mapping(address => string) public voterNames;
    
    VoteRecord[] public voteHistory;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Chi danh cho Admin!");
        _;
    }

    modifier onlyDuringElection() {
        require(electionStarted, "Cuoc bau cu chua bat dau!");
        require(block.timestamp >= startTime, "Chua den thoi gian bau cu!");
        require(block.timestamp <= endTime, "Thoi gian bau cu da ket thuc!");
        _;
    }

    constructor() {
        admin = msg.sender;
        electionRound = 0;
        electionStarted = false;
        maxVotesPerVoter = 1; // Mặc định ban đầu là 1
    }

    // --- QUẢN LÝ CHẾ ĐỘ & WHITELIST ---
    function setElectionMode(bool _isPrivate) public onlyAdmin {
        isPrivate = _isPrivate;
    }

    function addToWhitelist(address _voter) public onlyAdmin {
        require(_voter != address(0), "Dia chi khong hop le!");
        if (!whitelist[_voter]) {
            whitelist[_voter] = true;
            whitelistAddresses.push(_voter);
        }
    }

    function removeFromWhitelist(address _voter) public onlyAdmin {
        require(whitelist[_voter], "Dia chi khong co trong Whitelist!");
        whitelist[_voter] = false;
        
        for (uint256 i = 0; i < whitelistAddresses.length; i++) {
            if (whitelistAddresses[i] == _voter) {
                whitelistAddresses[i] = whitelistAddresses[whitelistAddresses.length - 1];
                whitelistAddresses.pop();
                break;
            }
        }
    }

    function getWhitelist() public view returns (address[] memory) {
        return whitelistAddresses;
    }

    // --- CÁC HÀM ĐIỀU KHIỂN BẦU CỬ (CẬP NHẬT THAM SỐ MỚI) ---
    function startElection(uint256 _durationMinutes, uint256 _maxVotes) public onlyAdmin {
        require(_maxVotes > 0, "So phieu bau toi da phai lon hon 0!");
        if (electionStarted) {
            require(block.timestamp > endTime, "Dot bau cu hien tai chua ket thuc!");
        }
        
        electionRound++;
        maxVotesPerVoter = _maxVotes; // Cập nhật số phiếu tối đa cho đợt này
        startTime = block.timestamp;
        endTime = block.timestamp + (_durationMinutes * 1 minutes);
        electionStarted = true;

        for (uint256 i = 1; i <= candidatesCount; i++) {
            candidates[i].voteCount = 0;
        }
    }

    function endElection() public onlyAdmin {
        require(electionStarted, "Cuoc bau cu chua duoc bat dau!");
        electionStarted = false;
        endTime = block.timestamp;
    }

    function vote(uint256 _candidateId) public onlyDuringElection {
        if (isPrivate) {
            require(whitelist[msg.sender], "Ban khong co ten trong Whitelist!");
        }

        // KIỂM TRA SỐ PHIẾU ĐÃ DÙNG TRONG ĐỢT HIỆN TẠI
        require(votesUsedInRound[msg.sender][electionRound] < maxVotesPerVoter, "Ban da het luot bau chon cho dot nay!");
        require(candidates[_candidateId].active, "Ung vien khong hop le!");

        votesUsedInRound[msg.sender][electionRound]++; // Tăng số phiếu đã dùng lên 1
        candidates[_candidateId].voteCount++;

        voteHistory.push(VoteRecord(msg.sender, _candidateId, block.timestamp, electionRound));
    }

    // --- QUẢN LÝ ỨNG CỬ VIÊN ---
    function addCandidate(string memory _name, string memory _imageCID) public onlyAdmin {
        candidatesCount++;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0, _imageCID, true);
    }

    function updateCandidate(uint256 _id, string memory _newName, string memory _newImageCID) public onlyAdmin {
        require(_id > 0 && _id <= candidatesCount, "Ung vien khong ton tai!");
        require(candidates[_id].active, "Ung vien da bi xoa!");
        candidates[_id].name = _newName;
        candidates[_id].imageCID = _newImageCID;
    }

    function deleteCandidate(uint256 _candidateId) public onlyAdmin {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Loi ID!");
        candidates[_candidateId].active = false;
    }

    // --- HÀM VIEW & HỖ TRỢ ---
    function registerVoter(string memory _name) public {
        require(bytes(_name).length > 0, "Ten khong hop le!");
        voterNames[msg.sender] = _name;
    }

    function getCandidate(uint256 _candidateId) public view returns (uint256, string memory, uint256, string memory, bool) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.voteCount, c.imageCID, c.active);
    }

    function getVoteHistoryCount() public view returns (uint256) {
        return voteHistory.length;
    }
}