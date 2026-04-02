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

    // --- CÁC BIẾN MỚI CHO WHITELIST ---
    bool public isPrivate = false; 
    mapping(address => bool) public whitelist;

    mapping(uint256 => Candidate) public candidates;
    mapping(address => uint256) public lastVotedRound;
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
    }

    // --- QUẢN LÝ CHẾ ĐỘ & WHITELIST ---
    function setElectionMode(bool _isPrivate) public onlyAdmin {
        isPrivate = _isPrivate;
    }

    function addToWhitelist(address _voter) public onlyAdmin {
        whitelist[_voter] = true;
    }

    function removeFromWhitelist(address _voter) public onlyAdmin {
        whitelist[_voter] = false;
    }

    // --- CÁC HÀM ĐIỀU KHIỂN BẦU CỬ ---
    function startElection(uint256 _durationMinutes) public onlyAdmin {
        if (electionStarted) {
            require(block.timestamp > endTime, "Dot bau cu hien tai chua ket thuc!");
        }
        
        electionRound++;
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
        // Kiểm tra Whitelist nếu ở chế độ Riêng tư
        if (isPrivate) {
            require(whitelist[msg.sender], "Ban khong co ten trong danh sach trang (Whitelist)!");
        }

        require(lastVotedRound[msg.sender] < electionRound, "Ban da thuc hien bau chon trong dot nay roi!");
        require(candidates[_candidateId].active, "Ung vien nay da bi xoa!");

        lastVotedRound[msg.sender] = electionRound;
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
        require(candidates[_id].active, "Ung vien nay da bi xoa!");
        require(bytes(_newName).length > 0, "Ten khong duoc de trong!");

        candidates[_id].name = _newName;
        candidates[_id].imageCID = _newImageCID;
    }

    function deleteCandidate(uint256 _candidateId) public onlyAdmin {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Ung vien khong ton tai!");
        candidates[_candidateId].active = false;
    }

    // --- CÁC HÀM HỖ TRỢ KHÁC ---
    function registerVoter(string memory _name) public {
        require(bytes(_name).length > 0, "Ten khong duoc de trong!");
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