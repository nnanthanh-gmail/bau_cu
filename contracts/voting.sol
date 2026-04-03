// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DecentralizedVoting {
    struct Candidate {
        uint256 id;
        string name;
        uint256 voteCount; // phiếu của đợt hiện tại
        string imageCID;   // hiện dùng như URL ảnh / CID
        bool active;
    }

    struct ElectionRoundInfo {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        bool isPrivate;
        uint256 maxSelections;
        uint256 totalBallots;
        uint256 totalSelections;
        bool endedManually;
    }

    address public admin;
    uint256 public candidatesCount;
    uint256 public startTime;
    uint256 public endTime;
    bool public electionStarted;
    uint256 public electionRound;
    uint256 public maxSelections;
    bool public isPrivate;
    uint256 public totalVoteRecords;

    mapping(uint256 => Candidate) public candidates;
    mapping(address => uint256) public lastVotedRound;
    mapping(address => string) public voterNames;
    mapping(address => bool) private knownVoters;

    mapping(address => bool) public whitelist;
    mapping(address => uint256) private whitelistIndexPlusOne;
    address[] private whitelistAddresses;
    address[] private voterAddresses;

    mapping(uint256 => ElectionRoundInfo) private rounds;
    mapping(uint256 => mapping(uint256 => uint256)) private roundCandidateVotes;
    mapping(uint256 => mapping(address => bool)) public hasVotedInRound;

    event VoterRegistered(address indexed voter, string name);
    event CandidateAdded(uint256 indexed candidateId, string name, string imageCID);
    event CandidateUpdated(uint256 indexed candidateId, string name, string imageCID);
    event CandidateDeleted(uint256 indexed candidateId);
    event ElectionModeUpdated(bool isPrivate);
    event WhitelistUpdated(address indexed voter, bool allowed);
    event ElectionStarted(uint256 indexed round, uint256 startTime, uint256 endTime, bool isPrivate, uint256 maxSelections);
    event ElectionEnded(uint256 indexed round, uint256 endedAt, bool manualStop);
    event VoteCast(address indexed voter, uint256 indexed round, uint256[] candidateIds, uint256 timestamp);

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
        maxSelections = 1;
    }

    function setElectionMode(bool _isPrivate) external onlyAdmin {
        require(!electionStarted || block.timestamp > endTime, "Dang co dot bau cu dang dien ra!");
        isPrivate = _isPrivate;
        emit ElectionModeUpdated(_isPrivate);
    }

    function addToWhitelist(address _voter) external onlyAdmin {
        require(_voter != address(0), "Dia chi vi khong hop le!");
        if (!whitelist[_voter]) {
            whitelist[_voter] = true;
            if (whitelistIndexPlusOne[_voter] == 0) {
                whitelistAddresses.push(_voter);
                whitelistIndexPlusOne[_voter] = whitelistAddresses.length;
            }
            emit WhitelistUpdated(_voter, true);
        }
    }

    function removeFromWhitelist(address _voter) external onlyAdmin {
        if (whitelist[_voter]) {
            whitelist[_voter] = false;
            uint256 indexPlusOne = whitelistIndexPlusOne[_voter];
            if (indexPlusOne > 0) {
                uint256 index = indexPlusOne - 1;
                uint256 lastIndex = whitelistAddresses.length - 1;
                if (index != lastIndex) {
                    address moved = whitelistAddresses[lastIndex];
                    whitelistAddresses[index] = moved;
                    whitelistIndexPlusOne[moved] = index + 1;
                }
                whitelistAddresses.pop();
                whitelistIndexPlusOne[_voter] = 0;
            }
            emit WhitelistUpdated(_voter, false);
        }
    }

    function startElection(uint256 _durationMinutes, uint256 _maxSelections) external onlyAdmin {
        require(_durationMinutes > 0, "Thoi luong phai lon hon 0!");
        require(_maxSelections > 0, "So lua chon phai lon hon 0!");

        if (electionStarted) {
            require(block.timestamp > endTime, "Dot bau cu hien tai chua ket thuc!");
        }

        electionRound += 1;
        startTime = block.timestamp;
        endTime = block.timestamp + (_durationMinutes * 1 minutes);
        electionStarted = true;
        maxSelections = _maxSelections;

        rounds[electionRound] = ElectionRoundInfo({
            id: electionRound,
            startTime: startTime,
            endTime: endTime,
            isPrivate: isPrivate,
            maxSelections: _maxSelections,
            totalBallots: 0,
            totalSelections: 0,
            endedManually: false
        });

        for (uint256 i = 1; i <= candidatesCount; i++) {
            candidates[i].voteCount = 0;
        }

        emit ElectionStarted(electionRound, startTime, endTime, isPrivate, _maxSelections);
    }

    function endElection() external onlyAdmin {
        require(electionStarted, "Cuoc bau cu chua duoc bat dau!");
        electionStarted = false;
        endTime = block.timestamp;
        rounds[electionRound].endTime = block.timestamp;
        rounds[electionRound].endedManually = true;
        emit ElectionEnded(electionRound, block.timestamp, true);
    }

    function vote(uint256[] calldata _candidateIds) external onlyDuringElection {
        require(bytes(voterNames[msg.sender]).length > 0, "Ban chua dang ky ten cu tri!");
        require(_candidateIds.length > 0, "Phai chon it nhat 1 ung vien!");
        require(_candidateIds.length <= maxSelections, "Vuot qua so lua chon toi da!");

        if (isPrivate) {
            require(whitelist[msg.sender], "Ban khong co ten trong danh sach trang (Whitelist)!");
        }

        require(lastVotedRound[msg.sender] < electionRound, "Ban da thuc hien bau chon trong dot nay roi!");

        for (uint256 i = 0; i < _candidateIds.length; i++) {
            uint256 candidateId = _candidateIds[i];
            require(candidateId > 0 && candidateId <= candidatesCount, "Ung vien khong ton tai!");
            require(candidates[candidateId].active, "Ung vien nay da bi xoa!");

            for (uint256 j = i + 1; j < _candidateIds.length; j++) {
                require(candidateId != _candidateIds[j], "Khong duoc chon trung ung vien!");
            }

            candidates[candidateId].voteCount += 1;
            roundCandidateVotes[electionRound][candidateId] += 1;
        }

        lastVotedRound[msg.sender] = electionRound;
        hasVotedInRound[electionRound][msg.sender] = true;
        rounds[electionRound].totalBallots += 1;
        rounds[electionRound].totalSelections += _candidateIds.length;
        totalVoteRecords += 1;

        emit VoteCast(msg.sender, electionRound, _candidateIds, block.timestamp);
    }

    function addCandidate(string memory _name, string memory _imageCID) external onlyAdmin {
        require(bytes(_name).length > 0, "Ten khong duoc de trong!");
        candidatesCount += 1;
        candidates[candidatesCount] = Candidate(candidatesCount, _name, 0, _imageCID, true);
        emit CandidateAdded(candidatesCount, _name, _imageCID);
    }

    function updateCandidate(uint256 _id, string memory _newName, string memory _newImageCID) external onlyAdmin {
        require(_id > 0 && _id <= candidatesCount, "Ung vien khong ton tai!");
        require(candidates[_id].active, "Ung vien nay da bi xoa!");
        require(bytes(_newName).length > 0, "Ten khong duoc de trong!");

        candidates[_id].name = _newName;
        candidates[_id].imageCID = _newImageCID;
        emit CandidateUpdated(_id, _newName, _newImageCID);
    }

    function deleteCandidate(uint256 _candidateId) external onlyAdmin {
        require(_candidateId > 0 && _candidateId <= candidatesCount, "Ung vien khong ton tai!");
        candidates[_candidateId].active = false;
        emit CandidateDeleted(_candidateId);
    }

    function registerVoter(string memory _name) external {
        require(bytes(_name).length > 0, "Ten khong duoc de trong!");
        voterNames[msg.sender] = _name;

        if (!knownVoters[msg.sender]) {
            knownVoters[msg.sender] = true;
            voterAddresses.push(msg.sender);
        }

        emit VoterRegistered(msg.sender, _name);
    }

    function getCandidate(uint256 _candidateId) external view returns (uint256, string memory, uint256, string memory, bool) {
        Candidate memory c = candidates[_candidateId];
        return (c.id, c.name, c.voteCount, c.imageCID, c.active);
    }

    function getVoteHistoryCount() external view returns (uint256) {
        return totalVoteRecords;
    }

    function getWhitelistCount() external view returns (uint256) {
        return whitelistAddresses.length;
    }

    function getWhitelistAddressByIndex(uint256 index) external view returns (address) {
        require(index < whitelistAddresses.length, "Index vuot qua gioi han!");
        return whitelistAddresses[index];
    }

    function getRegisteredVoterCount() external view returns (uint256) {
        return voterAddresses.length;
    }

    function getRegisteredVoterByIndex(uint256 index) external view returns (address, string memory, bool, bool) {
        require(index < voterAddresses.length, "Index vuot qua gioi han!");
        address voter = voterAddresses[index];
        return (voter, voterNames[voter], whitelist[voter], hasVotedInRound[electionRound][voter]);
    }

    function getRoundSummary(uint256 roundId) external view returns (
        uint256,
        uint256,
        uint256,
        bool,
        uint256,
        uint256,
        uint256,
        bool
    ) {
        ElectionRoundInfo memory info = rounds[roundId];
        return (
            info.id,
            info.startTime,
            info.endTime,
            info.isPrivate,
            info.maxSelections,
            info.totalBallots,
            info.totalSelections,
            info.endedManually
        );
    }

    function getRoundCandidateVotes(uint256 roundId, uint256 candidateId) external view returns (uint256) {
        return roundCandidateVotes[roundId][candidateId];
    }
}
