let contract;
let signer;
let timerInterval;
const contractAddress = "0x4AB354388bEb70843b345e219bdc52840D6e2613";
const THEME_KEY = "bauCuTheme";

function applyTheme(theme) {
    const root = document.documentElement;
    const themeToggle = document.getElementById("themeToggle");
    const themeName = theme === "dark" ? "dark" : "light";
    root.setAttribute("data-theme", themeName);
    localStorage.setItem(THEME_KEY, themeName);

    if (themeToggle) {
        themeToggle.innerHTML = themeName === "dark"
            ? '<i class="fas fa-sun"></i><span>Chế độ sáng</span>'
            : '<i class="fas fa-moon"></i><span>Chế độ tối</span>';
    }
}

function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    const systemPrefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(savedTheme || (systemPrefersDark ? "dark" : "light"));

    const themeToggle = document.getElementById("themeToggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
            applyTheme(current === "dark" ? "light" : "dark");
        });
    }
}

async function init() {
    initTheme();

    if (window.ethereum) {
        try {
            const provider = new ethers.BrowserProvider(window.ethereum);
            window.ethereum.on("accountsChanged", () => location.reload());
            window.ethereum.on("chainChanged", () => location.reload());

            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                await setupContract();
                const userAddress = await signer.getAddress();
                await updateAuthUI(userAddress);
            }
        } catch (error) {
            console.error(error);
        }
    } else {
        alert("Vui lòng cài đặt MetaMask!");
    }
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
    const inputName = document.getElementById("voterNameInput").value.trim();
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
            roleLabel.innerText = "Quản trị viên";
            roleLabel.style.background = "linear-gradient(135deg, #cf5e64, #b85059)";
            roleLabel.style.color = "white";
        } else {
            roleLabel.innerText = "Người bầu chọn";
            roleLabel.style.background = "linear-gradient(135deg, #2d8a72, #4da88f)";
            roleLabel.style.color = "white";
        }
    }

    if (isAdmin) {
        if (adminBtn) adminBtn.style.display = "inline-flex";
        if (startBtn) startBtn.style.display = "inline-flex";

        try {
            const isStarted = await contract.electionStarted();
            const endTime = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            if (stopBtn) {
                stopBtn.style.display = isStarted && Number(endTime) > now ? "inline-flex" : "none";
            }

            const isPrivateMode = await contract.isPrivate();
            const modeSelect = document.getElementById("electionModeSelect");
            const whitelistMgmt = document.getElementById("whitelistManager");
            if (modeSelect) modeSelect.value = isPrivateMode.toString();
            if (whitelistMgmt) whitelistMgmt.style.display = isPrivateMode ? "block" : "none";
        } catch (err) {
            console.error(err);
        }
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
        const statusCard = timerLabel.closest(".election-status-card");

        try {
            const isStarted = await contract.electionStarted();
            const endTime = await contract.endTime();
            const now = Math.floor(Date.now() / 1000);
            const timeLeft = Number(endTime) - now;

            if (!isStarted || timeLeft <= 0) {
                timerLabel.innerHTML = isStarted
                    ? '<i class="fas fa-calendar-check"></i> Đã kết thúc. Admin có thể bắt đầu đợt mới.'
                    : '<i class="fas fa-pause-circle"></i> Trạng thái: Đang chờ Admin bắt đầu...';
                if (statusCard) {
                    statusCard.style.background = isStarted
                        ? "linear-gradient(135deg, #cf5e64, #b85059)"
                        : "linear-gradient(135deg, #5d6da5, #7e8fc8 60%, #92bfdf)";
                }
                return;
            }

            const min = Math.floor(timeLeft / 60);
            const sec = timeLeft % 60;
            timerLabel.innerHTML = `<i class="fas fa-hourglass-half fa-spin"></i> Thời gian còn lại: ${min}ph : ${sec}s`;

            if (statusCard) {
                statusCard.style.background = timeLeft <= 30
                    ? "linear-gradient(135deg, #d98d36, #e6a457)"
                    : "linear-gradient(135deg, #344979, #5d6da5 55%, #7fb7e0)";
            }
        } catch (err) {
            console.error(err);
        }
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

        if (!total) {
            historyDiv.innerHTML = '<p class="section-note">Chưa có bản ghi bỏ phiếu nào.</p>';
            return;
        }

        for (let i = total - 1; i >= Math.max(0, total - 10); i--) {
            const record = await contract.voteHistory(i);
            const [voter, candidateId, timestamp, round] = record;
            const timeString = formatTimestamp(timestamp);
            const fakeHash = ethers.keccak256(
                ethers.toUtf8Bytes(voter + timestamp.toString() + round.toString())
            );

            const row = document.createElement("div");
            row.className = "history-entry";
            row.innerHTML = `
                <div class="history-hash"><strong>Hash:</strong> ${fakeHash}</div>
                <div class="history-meta">
                    <i class="far fa-clock"></i> <strong>Thời gian:</strong> ${timeString}<br>
                    Ví: ${voter.substring(0, 8)}... | Ứng viên ID: ${candidateId} | Đợt: ${round}
                </div>
            `;
            historyDiv.appendChild(row);
        }
    } catch (err) {
        console.error("Lỗi tải lịch sử Hash:", err);
        historyDiv.innerHTML = '<p class="section-note">Không thể tải lịch sử phiếu bầu.</p>';
    }
}

async function loadCandidates(isAdmin) {
    const listDiv = document.getElementById("candidateList");
    const resultsDiv = document.getElementById("resultsChart");
    if (!listDiv || !resultsDiv) return;

    listDiv.innerHTML = '<p class="section-note">Đang tải dữ liệu...</p>';

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

        if (!candidatesData.length) {
            listDiv.innerHTML = '<p class="section-note">Chưa có ứng cử viên khả dụng.</p>';
            resultsDiv.innerHTML = '<p class="section-note">Chưa có dữ liệu kết quả.</p>';
            return;
        }

        for (let candidate of candidatesData) {
            const [id, name, votes] = candidate;
            const percentage = totalVotes > 0 ? (Number(votes) / totalVotes) * 100 : 0;
            const safeName = String(name).replace(/'/g, "\\'").replace(/\"/g, "&quot;");

            const item = document.createElement("div");
            item.className = "candidate-item";
            item.innerHTML = `
                <div class="candidate-main">
                    <div class="candidate-avatar">${String(name).charAt(0).toUpperCase()}</div>
                    <div class="candidate-text">
                        <strong>${name}</strong>
                        <small>ID ứng cử viên: #${id}</small>
                    </div>
                </div>
                <div class="candidate-actions">
                    <button onclick="vote(${id})" class="vote-btn">Bầu chọn</button>
                    ${isAdmin ? `
                        <button onclick="openEditModal(${id}, '${safeName}')" class="icon-btn edit-btn" aria-label="Sửa ứng cử viên">
                            <i class="fas fa-pen"></i>
                        </button>
                        <button onclick="deleteCandidate(${id})" class="icon-btn delete-btn" aria-label="Xóa ứng cử viên">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ""}
                </div>
            `;
            listDiv.appendChild(item);

            const resultRow = document.createElement("div");
            resultRow.className = "result-row";
            resultRow.innerHTML = `
                <div class="result-head">
                    <span>${name}</span>
                    <span>${votes} phiếu · ${percentage.toFixed(1)}%</span>
                </div>
                <div class="result-sub">Tỷ lệ trên tổng số phiếu hợp lệ hiện tại</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${percentage}%;"></div>
                </div>
            `;
            resultsDiv.appendChild(resultRow);
        }
    } catch (err) {
        console.error(err);
        listDiv.innerHTML = '<p class="section-note">Không thể tải danh sách ứng cử viên.</p>';
        resultsDiv.innerHTML = '<p class="section-note">Không thể tải kết quả hiện tại.</p>';
    }
}

async function changeElectionMode() {
    const isPrivate = document.getElementById("electionModeSelect").value === "true";
    try {
        const tx = await contract.setElectionMode(isPrivate);
        alert("Đang cập nhật chế độ...");
        await tx.wait();
        alert("Thành công!");
        location.reload();
    } catch (e) {
        alert(e.reason || "Lỗi giao dịch!");
    }
}

async function addVoterToWhitelist() {
    const addr = document.getElementById("whitelistAddressInput").value.trim();
    if (!ethers.isAddress(addr)) return alert("Ví không hợp lệ!");
    try {
        const tx = await contract.addToWhitelist(addr);
        alert("Đang xử lý...");
        await tx.wait();
        alert("Đã thêm vào whitelist!");
        location.reload();
    } catch (e) {
        alert(e.reason || "Lỗi!");
    }
}

async function handleStartElection() {
    const min = prompt("Nhập số phút bầu cử mới:", "10");
    if (!min) return;
    try {
        const tx = await contract.startElection(min);
        alert("Đang kích hoạt đợt mới...");
        await tx.wait();
        location.reload();
    } catch (e) {
        alert(e.reason || "Lỗi: Cuộc bầu cử cũ chưa kết thúc!");
    }
}

async function handleEndElection() {
    if (!confirm("Xác nhận dừng cuộc bầu cử ngay lập tức?")) return;
    try {
        const tx = await contract.endElection();
        alert("Đang yêu cầu dừng cuộc bầu cử...");
        await tx.wait();
        alert("Đã dừng cuộc bầu cử thành công!");
        location.reload();
    } catch (e) {
        alert(e.reason || "Lỗi khi dừng cuộc bầu cử!");
    }
}

async function vote(id) {
    try {
        const tx = await contract.vote(id);
        await tx.wait();
        alert("Bầu chọn thành công!");
        location.reload();
    } catch (e) {
        alert(e.reason || "Lỗi: Bạn không có quyền hoặc đã bầu!");
    }
}

async function addNewCandidate() {
    const nameInput = document.getElementById("candidateNameInput");
    if (!nameInput || !nameInput.value.trim()) return alert("Nhập tên!");
    try {
        const tx = await contract.addCandidate(nameInput.value.trim(), "");
        await tx.wait();
        location.reload();
    } catch (e) {
        alert(e.reason || e.message);
    }
}

async function deleteCandidate(id) {
    if (!confirm("Xác nhận xóa ứng viên này?")) return;
    try {
        const tx = await contract.deleteCandidate(id);
        await tx.wait();
        location.reload();
    } catch (e) {
        alert(e.reason || e.message);
    }
}

function openEditModal(id, currentName) {
    document.getElementById("editCandidateId").value = id;
    document.getElementById("editCandidateName").value = currentName;
    document.getElementById("modalBackdrop").style.display = "block";
    document.getElementById("editCandidateSection").style.display = "block";
}

function closeEditModal() {
    document.getElementById("modalBackdrop").style.display = "none";
    document.getElementById("editCandidateSection").style.display = "none";
}

async function saveCandidateEdit() {
    const id = document.getElementById("editCandidateId").value;
    const newName = document.getElementById("editCandidateName").value.trim();
    if (!newName) return alert("Vui lòng nhập tên!");

    try {
        const tx = await contract.updateCandidate(id, newName, "");
        alert("Đang cập nhật thông tin...");
        await tx.wait();
        alert("Cập nhật thành công!");
        location.reload();
    } catch (e) {
        alert(e.reason || "Lỗi khi cập nhật!");
    }
}

function formatTimestamp(ts) {
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString("vi-VN");
}

window.handleAuth = handleAuth;
window.handleStartElection = handleStartElection;
window.handleEndElection = handleEndElection;
window.vote = vote;
window.addNewCandidate = addNewCandidate;
window.deleteCandidate = deleteCandidate;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveCandidateEdit = saveCandidateEdit;
window.changeElectionMode = changeElectionMode;
window.addVoterToWhitelist = addVoterToWhitelist;
window.toggleAdminPanel = () => {
    const panel = document.getElementById("adminSection");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
};

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeEditModal();
});

init();
