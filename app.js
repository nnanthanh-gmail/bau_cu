let contract;
let signer;
let timerInterval;
const contractAddress = "0x4AB354388bEb70843b345e219bdc52840D6e2613"; 

async function init() {
    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            window.ethereum.on('accountsChanged', () => location.reload());
            window.ethereum.on('chainChanged', () => location.reload());

            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                await setupContract();
                const userAddress = await signer.getAddress();
                await updateAuthUI(userAddress);
            }
        } catch (error) { console.error(error); }
    } else { alert("Vui lòng cài đặt MetaMask!"); }
}

async function setupContract() {
    const provider = new ethers.BrowserProvider(window.ethereum);
    signer = await provider.getSigner();
    contract = new ethers.Contract(contractAddress, contractABI, signer);
}

async function updateAuthUI(address) {
    const registeredName = await contract.voterNames(address);
    if (registeredName) showDashboard(address, registeredName);
}

async function handleAuth() {
    await setupContract();
    const inputName = document.getElementById("voterNameInput").value;
    if (!inputName) return alert("Nhập tên!");
    const tx = await contract.registerVoter(inputName);
    await tx.wait();
    location.reload();
}

async function showDashboard(address, name) {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";

    const adminAddr = await contract.admin();
    const adminBtn = document.getElementById("adminQuickBtn");
    const startBtn = document.getElementById("startElectionBtn");
    const stopBtn = document.getElementById("stopElectionBtn");
    const roleLabel = document.getElementById("userRole"); 

    const isAdmin = address.toLowerCase() === adminAddr.toLowerCase();

    if (roleLabel) {
        if (isAdmin) {
            roleLabel.innerText = "QUẢN TRỊ VIÊN (ADMIN)";
            roleLabel.style.background = "#e74c3c"; 
            roleLabel.style.color = "white";
        } else {
            roleLabel.innerText = "NGƯỜI BẦU CHỌN (VOTER)";
            roleLabel.style.background = "#2ecc71"; 
            roleLabel.style.color = "white";
        }
    }

    if (isAdmin) {
        if (adminBtn) adminBtn.style.display = "inline-block";
        if (startBtn) startBtn.style.display = "block";

        try {
            const isStarted = await contract.electionStarted();
            const endTime = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            if (stopBtn) {
                stopBtn.style.display = (isStarted && Number(endTime) > now) ? "block" : "none";
            }

            // Cập nhật UI Whitelist cho Admin
            const isPrivateMode = await contract.isPrivate();
            const modeSelect = document.getElementById("electionModeSelect");
            const whitelistMgmt = document.getElementById("whitelistManager");
            if (modeSelect) modeSelect.value = isPrivateMode.toString();
            if (whitelistMgmt) whitelistMgmt.style.display = isPrivateMode ? "block" : "none";

        } catch (err) { console.error(err); }
    }

    document.getElementById("displayName").innerText = `Xin chào: ${name}`;
    loadCandidates(isAdmin); 
    loadVoteHistory(); 
    runCountdown();
}

async function runCountdown() {
    if (timerInterval) clearInterval(timerInterval);
    
    const updateUI = async () => {
        const timerLabel = document.getElementById("timerDisplay");
        if (!timerLabel) return;
        const statusCard = timerLabel.closest('.election-status-card');

        try {
            const isStarted = await contract.electionStarted();
            const endTime = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            const timeLeft = Number(endTime) - now;

            if (!isStarted || timeLeft <= 0) {
                timerLabel.innerHTML = isStarted 
                    ? `<i class="fas fa-calendar-check"></i> Đã kết thúc. Admin có thể bắt đầu đợt mới.`
                    : `<i class="fas fa-pause-circle"></i> Trạng thái: Đang chờ Admin bắt đầu...`;
                if (statusCard && isStarted) statusCard.style.background = "linear-gradient(135deg, #e74c3c, #c0392b)";
                return;
            }

            const min = Math.floor(timeLeft / 60);
            const sec = timeLeft % 60;
            timerLabel.innerHTML = `<i class="fas fa-hourglass-half fa-spin"></i> Thời gian còn lại: ${min}ph : ${sec}s`;
            
            if (timeLeft <= 30 && statusCard) {
                statusCard.style.background = "linear-gradient(135deg, #f1c40f, #f39c12)";
            }
        } catch (err) { console.error(err); }
    };

    await updateUI();
    timerInterval = setInterval(updateUI, 1000);
}

async function loadVoteHistory() {
    const historyDiv = document.getElementById("voteHistoryList");
    if (!historyDiv) return;

    try {
        const count = await contract.getVoteHistoryCount();
        const total = Number(count);
        historyDiv.innerHTML = "";

        for (let i = total - 1; i >= Math.max(0, total - 10); i--) {
            const record = await contract.voteHistory(i);
            const [voter, candidateId, timestamp, round] = record;
            const timeString = formatTimestamp(timestamp); 
            const fakeHash = ethers.keccak256(ethers.toUtf8Bytes(voter + timestamp.toString() + round.toString()));

            const row = document.createElement("div");
            row.style = "padding: 10px; border-bottom: 1px solid #eee; font-size: 0.85rem; font-family: monospace; background: white; margin-bottom: 5px; border-radius: 5px;";
            row.innerHTML = `
                <div style="color: #2ecc71; word-break: break-all;"><strong>Hash:</strong> ${fakeHash}</div>
                <div style="color: #7f8c8d; margin-top: 5px;">
                    <i class="far fa-clock"></i> <strong>Thời gian:</strong> ${timeString} <br>
                    Ví: ${voter.substring(0, 8)}... | Ứng viên ID: ${candidateId} | Đợt: ${round}
                </div>
            `;
            historyDiv.appendChild(row);
        }
    } catch (err) { console.error("Lỗi tải lịch sử Hash:", err); }
}

async function loadCandidates(isAdmin) {
    const listDiv = document.getElementById("candidateList");
    const resultsDiv = document.getElementById("resultsChart");
    if (!listDiv || !resultsDiv) return;

    listDiv.innerHTML = "<p>Đang tải dữ liệu...</p>";
    
    try {
        const count = await contract.candidatesCount();
        const totalCandidates = Number(count);
        let totalVotes = 0;
        const candidatesData = [];

        for (let i = 1; i <= totalCandidates; i++) {
            const c = await contract.getCandidate(i); 
            if (c[4]) { 
                totalVotes += Number(c[2]);
                candidatesData.push(c);
            }
        }

        listDiv.innerHTML = "";
        resultsDiv.innerHTML = "";
        
        for (let candidate of candidatesData) {
            const [id, name, votes] = candidate;
            const percentage = totalVotes > 0 ? (Number(votes) / totalVotes * 100) : 0;
            const avatarHTML = `<div style="width:50px; height:50px; border-radius:50%; background:#3498db; color:white; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:1.2rem;">${name.charAt(0).toUpperCase()}</div>`;

            const item = document.createElement("div");
            item.className = "candidate-item";
            item.style = "display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px; padding: 10px; border: 1px solid #eee; border-radius: 8px;";
            
            item.innerHTML = `
                <div style="display: flex; align-items: center; gap: 15px;">
                    ${avatarHTML}
                    <div><strong>${name}</strong><br><small>ID: #${id}</small></div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button onclick="vote(${id})" style="padding: 5px 15px; cursor: pointer; background:#3498db; color:white; border:none; border-radius:4px;">Bầu</button>
                    ${isAdmin ? `
                        <button onclick="openEditModal(${id}, '${name}')" style="padding: 5px 10px; cursor: pointer; background:#f1c40f; color:white; border:none; border-radius:4px;"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteCandidate(${id})" style="padding: 5px 10px; cursor: pointer; background:#e74c3c; color:white; border:none; border-radius:4px;"><i class="fas fa-trash"></i></button>
                    ` : ""}
                </div>
            `;
            listDiv.appendChild(item);

            const resultRow = document.createElement("div");
            resultRow.style = "margin-bottom: 10px;";
            resultRow.innerHTML = `
                <div style="display: flex; justify-content: space-between;">
                    <span>${name}</span>
                    <span><strong>${votes}</strong> phiếu (${percentage.toFixed(1)}%)</span>
                </div>
                <div style="background: #eee; height: 8px; border-radius: 4px; margin-top: 5px;">
                    <div style="background: #3498db; width: ${percentage}%; height: 100%; border-radius: 4px;"></div>
                </div>`;
            resultsDiv.appendChild(resultRow);
        }
    } catch (err) { console.error(err); }
}

// --- CÁC HÀM MỚI CHO WHITELIST & MODE ---
async function changeElectionMode() {
    const isPrivate = document.getElementById("electionModeSelect").value === "true";
    try {
        const tx = await contract.setElectionMode(isPrivate);
        alert("Đang cập nhật chế độ...");
        await tx.wait();
        alert("Thành công!");
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi giao dịch!"); }
}

async function addVoterToWhitelist() {
    const addr = document.getElementById("whitelistAddressInput").value;
    if (!ethers.isAddress(addr)) return alert("Ví không hợp lệ!");
    try {
        const tx = await contract.addToWhitelist(addr);
        alert("Đang xử lý...");
        await tx.wait();
        alert("Đã thêm vào Whitelist!");
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi!"); }
}

async function handleStartElection() {
    const min = prompt("Nhập số phút bầu cử mới:", "10");
    if (!min) return;
    try {
        const tx = await contract.startElection(min);
        alert("Đang kích hoạt đợt mới...");
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi: Cuộc bầu cử cũ chưa kết thúc!"); }
}

async function handleEndElection() {
    if (!confirm("Xác nhận dừng cuộc bầu cử ngay lập tức?")) return;
    try {
        const tx = await contract.endElection();
        alert("Đang yêu cầu dừng cuộc bầu cử...");
        await tx.wait();
        alert("Đã dừng cuộc bầu cử thành công!");
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi khi dừng cuộc bầu cử!"); }
}

async function vote(id) {
    try {
        const tx = await contract.vote(id);
        await tx.wait();
        alert("Bầu chọn thành công!");
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi: Bạn không có quyền hoặc đã bầu!"); }
}

async function addNewCandidate() {
    const nameInput = document.getElementById("candidateNameInput");
    if (!nameInput || !nameInput.value) return alert("Nhập tên!");
    try {
        const tx = await contract.addCandidate(nameInput.value, "");
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || e.message); }
}

async function deleteCandidate(id) {
    if (!confirm("Xác nhận xóa ứng viên này?")) return;
    try {
        const tx = await contract.deleteCandidate(id);
        await tx.wait();
        location.reload();
    } catch (e) { alert(e.reason || e.message); }
}

function openEditModal(id, currentName) {
    document.getElementById("editCandidateId").value = id;
    document.getElementById("editCandidateName").value = currentName;
    document.getElementById("editCandidateSection").style.display = "block";
}

async function saveCandidateEdit() {
    const id = document.getElementById("editCandidateId").value;
    const newName = document.getElementById("editCandidateName").value;
    if (!newName) return alert("Vui lòng nhập tên!");

    try {
        const tx = await contract.updateCandidate(id, newName, ""); 
        alert("Đang cập nhật thông tin...");
        await tx.wait();
        alert("Cập nhật thành công!");
        location.reload();
    } catch (e) { alert(e.reason || "Lỗi khi cập nhật!"); }
}

function formatTimestamp(ts) {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString('vi-VN');
}

window.handleAuth = handleAuth;
window.handleStartElection = handleStartElection;
window.handleEndElection = handleEndElection;
window.vote = vote;
window.addNewCandidate = addNewCandidate;
window.deleteCandidate = deleteCandidate;
window.openEditModal = openEditModal;
window.saveCandidateEdit = saveCandidateEdit;
window.changeElectionMode = changeElectionMode;
window.addVoterToWhitelist = addVoterToWhitelist;
window.toggleAdminPanel = () => {
    const p = document.getElementById("adminSection");
    p.style.display = p.style.display === "none" ? "block" : "none";
};

init();