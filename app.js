let contract;
let signer;
let provider;
let timerInterval;
let currentAccount = "";
let currentUserName = "";
let currentIsAdmin = false;
let currentRoundId = 0;
let currentMaxSelections = 1;
let currentCandidates = [];

const contractAddress = "REPLACE_WITH_NEW_DEPLOYED_CONTRACT_ADDRESS";
const THEME_KEY = "bauCuTheme";
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

function isConfiguredContractAddress(address) {
    return typeof address === "string" && /^0x[a-fA-F0-9]{40}$/.test(address) && address !== ZERO_ADDRESS;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function shortAddress(address) {
    return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : "";
}

function formatTimestamp(ts) {
    if (!ts) return "—";
    const date = new Date(Number(ts) * 1000);
    return date.toLocaleString("vi-VN");
}

function showToast(message) {
    alert(message);
}

function setWalletStatus(message, isError = false) {
    const status = document.getElementById("walletStatus");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("status-error", isError);
}

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

async function setupContract(requestAccess = false) {
    if (!window.ethereum) {
        throw new Error("Vui lòng cài đặt MetaMask để sử dụng hệ thống.");
    }

    if (!isConfiguredContractAddress(contractAddress)) {
        throw new Error("Chưa cập nhật địa chỉ contract mới trong app.js sau khi deploy.");
    }

    provider = new ethers.BrowserProvider(window.ethereum);

    if (requestAccess) {
        await provider.send("eth_requestAccounts", []);
    }

    const accounts = await provider.listAccounts();
    if (!accounts.length) {
        return false;
    }

    signer = await provider.getSigner();
    currentAccount = await signer.getAddress();
    contract = new ethers.Contract(contractAddress, contractABI, signer);
    return true;
}

async function connectWallet() {
    try {
        const connected = await setupContract(true);
        if (!connected) {
            setWalletStatus("Chưa có tài khoản MetaMask được cấp quyền.", true);
            return;
        }
        setWalletStatus(`Đã kết nối: ${shortAddress(currentAccount)}`);
        await updateAuthUI();
    } catch (error) {
        console.error(error);
        setWalletStatus(error.message || "Không thể kết nối ví.", true);
    }
}

async function init() {
    initTheme();

    if (!window.ethereum) {
        setWalletStatus("Chưa phát hiện MetaMask trên trình duyệt.", true);
        return;
    }

    window.ethereum.on("accountsChanged", () => location.reload());
    window.ethereum.on("chainChanged", () => location.reload());

    try {
        const connected = await setupContract(false);
        if (connected) {
            setWalletStatus(`Đã kết nối: ${shortAddress(currentAccount)}`);
            await updateAuthUI();
        } else {
            setWalletStatus("Chưa kết nối ví.");
        }
    } catch (error) {
        console.error(error);
        setWalletStatus(error.message || "Không thể khởi tạo kết nối ví.", true);
    }
}

async function updateAuthUI() {
    if (!contract || !currentAccount) {
        document.getElementById("registerPanel").style.display = "none";
        return;
    }

    const registeredName = await contract.voterNames(currentAccount);
    if (registeredName) {
        currentUserName = registeredName;
        await showDashboard();
    } else {
        document.getElementById("authSection").style.display = "flex";
        document.getElementById("mainDashboard").style.display = "none";
        document.getElementById("registerPanel").style.display = "block";
    }
}

async function handleRegister() {
    try {
        if (!contract) {
            const connected = await setupContract(true);
            if (!connected) return;
        }
        const inputName = document.getElementById("voterNameInput").value.trim();
        if (!inputName) return showToast("Nhập tên cử tri trước.");
        const tx = await contract.registerVoter(inputName);
        showToast("Đang ghi tên cử tri lên blockchain...");
        await tx.wait();
        currentUserName = inputName;
        location.reload();
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Không thể đăng ký tên cử tri.");
    }
}

async function showDashboard() {
    document.getElementById("authSection").style.display = "none";
    document.getElementById("mainDashboard").style.display = "block";

    const adminAddr = await contract.admin();
    currentIsAdmin = currentAccount.toLowerCase() === adminAddr.toLowerCase();

    const roleLabel = document.getElementById("userRole");
    roleLabel.innerText = currentIsAdmin ? "Quản trị viên" : "Người bầu chọn";
    roleLabel.style.background = currentIsAdmin
        ? "linear-gradient(135deg, #cf5e64, #b85059)"
        : "linear-gradient(135deg, #2d8a72, #4da88f)";
    roleLabel.style.color = "white";

    document.getElementById("displayName").innerText = `Xin chào: ${currentUserName}`;
    document.getElementById("userMeta").innerText = `Ví: ${shortAddress(currentAccount)}`;

    const adminBtn = document.getElementById("adminQuickBtn");
    const startBtn = document.getElementById("startElectionBtn");
    adminBtn.style.display = currentIsAdmin ? "inline-flex" : "none";
    startBtn.style.display = currentIsAdmin ? "inline-flex" : "none";

    await refreshAll();
}

async function refreshAll() {
    await loadElectionState();
    await loadCandidates();
    await loadVoteHistory();
    await loadRoundHistory();
    if (currentIsAdmin) {
        await Promise.all([
            syncAdminConfig(),
            loadWhitelist(),
            loadRegisteredVoters()
        ]);
    }
    runCountdown();
}

async function loadElectionState() {
    currentRoundId = Number(await contract.electionRound());
    currentMaxSelections = Number(await contract.maxSelections());

    const roundSummaryBox = document.getElementById("currentRoundSummary");
    const timerLabel = document.getElementById("timerDisplay");
    const stopBtn = document.getElementById("stopElectionBtn");
    const voteModeHint = document.getElementById("voteModeHint");

    const started = await contract.electionStarted();
    const endTime = Number(await contract.endTime());
    const now = Math.floor(Date.now() / 1000);
    const isOpen = started && now <= endTime;

    if (currentIsAdmin) {
        stopBtn.style.display = isOpen ? "inline-flex" : "none";
    }

    if (!currentRoundId) {
        roundSummaryBox.innerHTML = '<div class="status-badge">Chưa có đợt bầu cử nào.</div>';
        timerLabel.innerHTML = '<i class="fas fa-pause-circle"></i> Trạng thái: Đang chờ Admin tạo đợt đầu tiên.';
        voteModeHint.innerText = "Chưa có đợt bầu cử đang hoạt động.";
        return;
    }

    const summary = await contract.getRoundSummary(currentRoundId);
    const modeText = summary[3] ? "Giới hạn whitelist" : "Công khai";
    currentMaxSelections = Number(summary[4]);
    const totalBallots = Number(summary[5]);
    const totalSelections = Number(summary[6]);
    const manualText = summary[7] ? " · Dừng tay" : "";

    voteModeHint.innerText = isOpen
        ? `Đợt hiện tại cho phép chọn tối đa ${currentMaxSelections} ứng cử viên / 1 lá phiếu.`
        : `Đợt #${currentRoundId} đã kết thúc. Có thể xem lại lịch sử bên dưới.`;

    roundSummaryBox.innerHTML = `
        <div class="status-badge">Đợt #${currentRoundId}</div>
        <div class="status-badge">${modeText}</div>
        <div class="status-badge">Tối đa ${currentMaxSelections} lựa chọn</div>
        <div class="status-badge">${totalBallots} cử tri đã bỏ phiếu</div>
        <div class="status-badge">${totalSelections} lượt chọn${manualText}</div>
    `;
}

function runCountdown() {
    if (timerInterval) clearInterval(timerInterval);

    const updateUI = async () => {
        if (!contract) return;
        const timerLabel = document.getElementById("timerDisplay");
        const statusCard = timerLabel?.closest(".election-status-card");
        if (!timerLabel) return;

        try {
            const isStarted = await contract.electionStarted();
            const endTime = Number(await contract.endTime());
            const now = Math.floor(Date.now() / 1000);
            const timeLeft = endTime - now;

            if (!isStarted || timeLeft <= 0) {
                timerLabel.innerHTML = isStarted
                    ? '<i class="fas fa-calendar-check"></i> Đợt hiện tại đã kết thúc.'
                    : '<i class="fas fa-pause-circle"></i> Trạng thái: Đang chờ Admin bắt đầu...';
                if (statusCard) {
                    statusCard.style.background = isStarted
                        ? "linear-gradient(135deg, #cf5e64, #b85059)"
                        : "linear-gradient(135deg, #5d6da5, #7e8fc8 60%, #92bfdf)";
                }
                return;
            }

            const hour = Math.floor(timeLeft / 3600);
            const min = Math.floor((timeLeft % 3600) / 60);
            const sec = timeLeft % 60;
            timerLabel.innerHTML = `<i class="fas fa-hourglass-half fa-spin"></i> Thời gian còn lại: ${hour}h ${min}ph ${sec}s`;
            if (statusCard) {
                statusCard.style.background = timeLeft <= 30
                    ? "linear-gradient(135deg, #d98d36, #e6a457)"
                    : "linear-gradient(135deg, #344979, #5d6da5 55%, #7fb7e0)";
            }
        } catch (error) {
            console.error(error);
        }
    };

    updateUI();
    timerInterval = setInterval(updateUI, 1000);
}

async function loadCandidates() {
    const listDiv = document.getElementById("candidateList");
    const resultsDiv = document.getElementById("resultsChart");
    const bulkVoteActions = document.getElementById("bulkVoteActions");
    if (!listDiv || !resultsDiv) return;

    listDiv.innerHTML = '<p class="section-note">Đang tải dữ liệu...</p>';
    resultsDiv.innerHTML = '<p class="section-note">Đang tải dữ liệu...</p>';

    const count = Number(await contract.candidatesCount());
    const started = await contract.electionStarted();
    const endTime = Number(await contract.endTime());
    const now = Math.floor(Date.now() / 1000);
    const isOpen = started && now <= endTime;
    const hasVoted = currentRoundId ? await contract.hasVotedInRound(currentRoundId, currentAccount) : false;

    const candidates = [];
    let totalVotes = 0;

    for (let i = 1; i <= count; i++) {
        const c = await contract.getCandidate(i);
        if (c[4]) {
            const record = {
                id: Number(c[0]),
                name: c[1],
                votes: Number(c[2]),
                image: c[3],
                active: c[4]
            };
            totalVotes += record.votes;
            candidates.push(record);
        }
    }

    currentCandidates = candidates;
    listDiv.innerHTML = "";
    resultsDiv.innerHTML = "";

    if (!candidates.length) {
        listDiv.innerHTML = '<p class="section-note">Chưa có ứng cử viên khả dụng.</p>';
        resultsDiv.innerHTML = '<p class="section-note">Chưa có dữ liệu kết quả.</p>';
        bulkVoteActions.style.display = "none";
        return;
    }

    for (const candidate of candidates) {
        const percentage = totalVotes > 0 ? (candidate.votes / totalVotes) * 100 : 0;
        const safeName = escapeHtml(candidate.name);
        const safeImage = escapeHtml(candidate.image || "");
        const imageBlock = safeImage
            ? `<img src="${safeImage}" alt="${safeName}" class="candidate-photo" onerror="this.style.display='none'; this.nextElementSibling.style.display='grid';"><div class="candidate-avatar fallback-avatar" style="display:none;">${safeName.charAt(0).toUpperCase()}</div>`
            : `<div class="candidate-avatar">${safeName.charAt(0).toUpperCase()}</div>`;

        const voteControl = isOpen && !hasVoted
            ? (currentMaxSelections > 1
                ? `<label class="candidate-check"><input type="checkbox" class="candidate-checkbox" value="${candidate.id}"> <span>Chọn</span></label>`
                : `<button onclick="voteOne(${candidate.id})" class="vote-btn">Bầu chọn</button>`)
            : `<span class="vote-disabled">${hasVoted ? "Đã bỏ phiếu" : (isOpen ? "" : "Chưa mở / đã đóng")}</span>`;

        const safeNameJs = candidate.name.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        const safeImageJs = (candidate.image || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");

        const adminControls = currentIsAdmin
            ? `
                <button onclick="openEditModal(${candidate.id}, '${safeNameJs}', '${safeImageJs}')" class="icon-btn edit-btn" aria-label="Sửa ứng cử viên">
                    <i class="fas fa-pen"></i>
                </button>
                <button onclick="deleteCandidate(${candidate.id})" class="icon-btn delete-btn" aria-label="Xóa ứng cử viên">
                    <i class="fas fa-trash"></i>
                </button>
            `
            : "";

        const item = document.createElement("div");
        item.className = "candidate-item";
        item.innerHTML = `
            <div class="candidate-main">
                <div class="candidate-media">${imageBlock}</div>
                <div class="candidate-text">
                    <strong>${safeName}</strong>
                    <small>ID ứng cử viên: #${candidate.id}</small>
                    ${safeImage ? `<small class="muted-inline">Có ảnh hiển thị</small>` : `<small class="muted-inline">Chưa có ảnh</small>`}
                </div>
            </div>
            <div class="candidate-actions">
                ${voteControl}
                ${adminControls}
            </div>
        `;
        listDiv.appendChild(item);

        const resultRow = document.createElement("div");
        resultRow.className = "result-row";
        resultRow.innerHTML = `
            <div class="result-head">
                <span>${safeName}</span>
                <span>${candidate.votes} phiếu · ${percentage.toFixed(1)}%</span>
            </div>
            <div class="result-sub">Tỷ lệ trên tổng lượt chọn hợp lệ của đợt hiện tại</div>
            <div class="bar-track">
                <div class="bar-fill" style="width: ${percentage}%;"></div>
            </div>
        `;
        resultsDiv.appendChild(resultRow);
    }

    bulkVoteActions.style.display = isOpen && !hasVoted && currentMaxSelections > 1 ? "block" : "none";
}

async function loadVoteHistory() {
    const historyDiv = document.getElementById("voteHistoryList");
    if (!historyDiv || !contract) return;

    try {
        historyDiv.innerHTML = '<p class="section-note">Đang tải lịch sử giao dịch...</p>';
        const logs = await contract.queryFilter(contract.filters.VoteCast());
        const recentLogs = logs.slice(-20).reverse();

        if (!recentLogs.length) {
            historyDiv.innerHTML = '<p class="section-note">Chưa có giao dịch bỏ phiếu nào.</p>';
            return;
        }

        const candidateNameMap = Object.fromEntries(currentCandidates.map(item => [item.id, item.name]));
        const rows = await Promise.all(recentLogs.map(async (log) => {
            const block = await provider.getBlock(log.blockNumber);
            const args = log.args || [];
            const candidateIds = (args.candidateIds || []).map(Number);
            const names = candidateIds.map(id => candidateNameMap[id] || `Ứng viên #${id}`);
            return {
                txHash: log.transactionHash,
                voter: args.voter,
                round: Number(args.round),
                candidateText: names.join(", "),
                time: block?.timestamp ? formatTimestamp(block.timestamp) : formatTimestamp(args.timestamp)
            };
        }));

        historyDiv.innerHTML = rows.map((row) => `
            <div class="history-entry">
                <div class="history-hash"><strong>Tx Hash:</strong> ${escapeHtml(row.txHash)}</div>
                <div class="history-meta">
                    <div><strong>Thời gian:</strong> ${escapeHtml(row.time)}</div>
                    <div><strong>Ví:</strong> ${escapeHtml(shortAddress(row.voter))}</div>
                    <div><strong>Đợt:</strong> #${row.round}</div>
                    <div><strong>Đã chọn:</strong> ${escapeHtml(row.candidateText || "—")}</div>
                </div>
            </div>
        `).join("");
    } catch (error) {
        console.error(error);
        historyDiv.innerHTML = '<p class="section-note">Không thể tải hash giao dịch. Hãy kiểm tra lại contract mới và mạng blockchain.</p>';
    }
}

async function loadRoundHistory() {
    const roundHistoryList = document.getElementById("roundHistoryList");
    if (!roundHistoryList) return;

    try {
        const roundCount = Number(await contract.electionRound());
        const candidateCount = Number(await contract.candidatesCount());
        if (!roundCount) {
            roundHistoryList.innerHTML = '<p class="section-note">Chưa có round nào để hiển thị.</p>';
            return;
        }

        const blocks = [];
        for (let round = roundCount; round >= 1; round--) {
            const summary = await contract.getRoundSummary(round);
            const modeText = summary[3] ? "Giới hạn whitelist" : "Công khai";
            const resultItems = [];

            for (let candidateId = 1; candidateId <= candidateCount; candidateId++) {
                const candidate = await contract.getCandidate(candidateId);
                const votes = Number(await contract.getRoundCandidateVotes(round, candidateId));
                if (votes > 0 || candidate[4]) {
                    resultItems.push(`${candidate[1]}: ${votes} phiếu`);
                }
            }

            blocks.push(`
                <div class="history-entry round-card">
                    <div class="history-hash">Đợt #${round}</div>
                    <div class="history-meta">
                        <div><strong>Bắt đầu:</strong> ${formatTimestamp(summary[1])}</div>
                        <div><strong>Kết thúc:</strong> ${formatTimestamp(summary[2])}</div>
                        <div><strong>Chế độ:</strong> ${modeText}</div>
                        <div><strong>Tối đa lựa chọn:</strong> ${summary[4]}</div>
                        <div><strong>Số cử tri đã bỏ phiếu:</strong> ${summary[5]}</div>
                        <div><strong>Tổng lượt chọn:</strong> ${summary[6]}</div>
                        <div><strong>Kết thúc thủ công:</strong> ${summary[7] ? "Có" : "Không"}</div>
                        <div><strong>Kết quả:</strong> ${escapeHtml(resultItems.join(" · ") || "Chưa có phiếu")}</div>
                    </div>
                </div>
            `);
        }

        roundHistoryList.innerHTML = blocks.join("");
    } catch (error) {
        console.error(error);
        roundHistoryList.innerHTML = '<p class="section-note">Không thể tải lịch sử các đợt bầu cử.</p>';
    }
}

async function syncAdminConfig() {
    const modeSelect = document.getElementById("electionModeSelect");
    const whitelistMgmt = document.getElementById("whitelistManager");
    const isPrivateMode = await contract.isPrivate();
    modeSelect.value = String(isPrivateMode);
    whitelistMgmt.style.display = isPrivateMode ? "block" : "none";
}

async function loadWhitelist() {
    const whitelistList = document.getElementById("whitelistList");
    if (!whitelistList) return;

    try {
        const count = Number(await contract.getWhitelistCount());
        if (!count) {
            whitelistList.innerHTML = '<p class="section-note">Whitelist đang trống.</p>';
            return;
        }

        const items = [];
        for (let i = 0; i < count; i++) {
            const address = await contract.getWhitelistAddressByIndex(i);
            items.push(`
                <div class="mini-list-row">
                    <span>${escapeHtml(address)}</span>
                    <button onclick="removeWhitelistAddress('${address}')" class="mini-danger-btn">Gỡ</button>
                </div>
            `);
        }
        whitelistList.innerHTML = items.join("");
    } catch (error) {
        console.error(error);
        whitelistList.innerHTML = '<p class="section-note">Không thể tải whitelist.</p>';
    }
}

async function loadRegisteredVoters() {
    const votersList = document.getElementById("registeredVotersList");
    if (!votersList) return;

    try {
        const count = Number(await contract.getRegisteredVoterCount());
        if (!count) {
            votersList.innerHTML = '<p class="section-note">Chưa có cử tri nào đăng ký.</p>';
            return;
        }

        const items = [];
        for (let i = 0; i < count; i++) {
            const voter = await contract.getRegisteredVoterByIndex(i);
            items.push(`
                <div class="mini-list-row voter-row">
                    <div>
                        <strong>${escapeHtml(voter[1] || "Chưa đặt tên")}</strong>
                        <div class="muted-inline">${escapeHtml(voter[0])}</div>
                    </div>
                    <div class="voter-flags">
                        <span class="status-badge small-badge">Whitelist: ${voter[2] ? "Có" : "Không"}</span>
                        <span class="status-badge small-badge">Đã bầu round hiện tại: ${voter[3] ? "Có" : "Không"}</span>
                    </div>
                </div>
            `);
        }
        votersList.innerHTML = items.join("");
    } catch (error) {
        console.error(error);
        votersList.innerHTML = '<p class="section-note">Không thể tải danh sách cử tri.</p>';
    }
}

async function changeElectionMode() {
    try {
        const isPrivate = document.getElementById("electionModeSelect").value === "true";
        const tx = await contract.setElectionMode(isPrivate);
        showToast("Đang cập nhật chế độ bầu cử...");
        await tx.wait();
        await syncAdminConfig();
        await loadWhitelist();
        showToast("Đã cập nhật chế độ thành công.");
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Lỗi khi cập nhật chế độ.");
    }
}

async function addVoterToWhitelist() {
    try {
        const addr = document.getElementById("whitelistAddressInput").value.trim();
        if (!ethers.isAddress(addr)) return showToast("Địa chỉ ví không hợp lệ.");
        const tx = await contract.addToWhitelist(addr);
        showToast("Đang thêm ví vào whitelist...");
        await tx.wait();
        document.getElementById("whitelistAddressInput").value = "";
        await Promise.all([loadWhitelist(), loadRegisteredVoters()]);
        showToast("Đã thêm vào whitelist.");
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Lỗi khi thêm whitelist.");
    }
}

async function removeWhitelistAddress(address) {
    if (!confirm(`Gỡ ${address} khỏi whitelist?`)) return;
    try {
        const tx = await contract.removeFromWhitelist(address);
        showToast("Đang gỡ ví khỏi whitelist...");
        await tx.wait();
        await Promise.all([loadWhitelist(), loadRegisteredVoters()]);
        showToast("Đã gỡ khỏi whitelist.");
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Lỗi khi gỡ whitelist.");
    }
}

async function handleStartElection() {
    try {
        const duration = Number(document.getElementById("electionDurationInput").value.trim());
        const maxChoices = Number(document.getElementById("maxSelectionsInput").value.trim());
        if (!duration || duration <= 0) return showToast("Nhập số phút hợp lệ.");
        if (!maxChoices || maxChoices <= 0) return showToast("Nhập số lựa chọn hợp lệ.");
        const tx = await contract.startElection(duration, maxChoices);
        showToast("Đang bắt đầu đợt bầu cử mới...");
        await tx.wait();
        await refreshAll();
        showToast("Đã bắt đầu đợt bầu cử mới.");
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Không thể bắt đầu đợt bầu cử.");
    }
}

async function handleEndElection() {
    if (!confirm("Xác nhận dừng cuộc bầu cử ngay lập tức?")) return;
    try {
        const tx = await contract.endElection();
        showToast("Đang gửi yêu cầu dừng cuộc bầu cử...");
        await tx.wait();
        await refreshAll();
        showToast("Đã dừng cuộc bầu cử thành công.");
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Lỗi khi dừng cuộc bầu cử.");
    }
}

async function voteOne(id) {
    await submitVote([Number(id)]);
}

async function voteSelectedCandidates() {
    const selected = Array.from(document.querySelectorAll(".candidate-checkbox:checked")).map((input) => Number(input.value));
    if (!selected.length) return showToast("Chọn ít nhất 1 ứng cử viên.");
    if (selected.length > currentMaxSelections) {
        return showToast(`Bạn chỉ được chọn tối đa ${currentMaxSelections} ứng cử viên.`);
    }
    await submitVote(selected);
}

async function submitVote(candidateIds) {
    try {
        const tx = await contract.vote(candidateIds);
        showToast("Đang gửi phiếu bầu lên blockchain...");
        await tx.wait();
        await refreshAll();
        showToast("Bầu chọn thành công!");
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Không thể bỏ phiếu.");
    }
}

async function addNewCandidate() {
    try {
        const nameInput = document.getElementById("candidateNameInput");
        const imageInput = document.getElementById("candidateImageInput");
        const name = nameInput.value.trim();
        const image = imageInput.value.trim();
        if (!name) return showToast("Nhập tên ứng cử viên.");
        const tx = await contract.addCandidate(name, image);
        showToast("Đang thêm ứng cử viên...");
        await tx.wait();
        nameInput.value = "";
        imageInput.value = "";
        await Promise.all([loadCandidates(), loadRoundHistory()]);
        showToast("Đã thêm ứng cử viên.");
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Không thể thêm ứng cử viên.");
    }
}

async function deleteCandidate(id) {
    if (!confirm("Xác nhận xóa ứng cử viên này?")) return;
    try {
        const tx = await contract.deleteCandidate(id);
        showToast("Đang xóa ứng cử viên...");
        await tx.wait();
        await Promise.all([loadCandidates(), loadRoundHistory()]);
        showToast("Đã xóa ứng cử viên.");
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Không thể xóa ứng cử viên.");
    }
}

function openEditModal(id, currentName, currentImage) {
    document.getElementById("editCandidateId").value = id;
    document.getElementById("editCandidateName").value = currentName || "";
    document.getElementById("editCandidateImage").value = currentImage || "";
    document.getElementById("modalBackdrop").style.display = "block";
    document.getElementById("editCandidateSection").style.display = "block";
}

function closeEditModal() {
    const backdrop = document.getElementById("modalBackdrop");
    const modal = document.getElementById("editCandidateSection");
    if (backdrop) backdrop.style.display = "none";
    if (modal) modal.style.display = "none";
}

async function saveCandidateEdit() {
    try {
        const id = document.getElementById("editCandidateId").value;
        const newName = document.getElementById("editCandidateName").value.trim();
        const newImage = document.getElementById("editCandidateImage").value.trim();
        if (!newName) return showToast("Vui lòng nhập tên ứng cử viên.");
        const tx = await contract.updateCandidate(id, newName, newImage);
        showToast("Đang cập nhật ứng cử viên...");
        await tx.wait();
        closeEditModal();
        await Promise.all([loadCandidates(), loadRoundHistory()]);
        showToast("Cập nhật thành công.");
    } catch (error) {
        console.error(error);
        showToast(error.reason || error.shortMessage || error.message || "Lỗi khi cập nhật ứng cử viên.");
    }
}

window.connectWallet = connectWallet;
window.handleRegister = handleRegister;
window.handleStartElection = handleStartElection;
window.handleEndElection = handleEndElection;
window.voteOne = voteOne;
window.voteSelectedCandidates = voteSelectedCandidates;
window.addNewCandidate = addNewCandidate;
window.deleteCandidate = deleteCandidate;
window.openEditModal = openEditModal;
window.closeEditModal = closeEditModal;
window.saveCandidateEdit = saveCandidateEdit;
window.changeElectionMode = changeElectionMode;
window.addVoterToWhitelist = addVoterToWhitelist;
window.removeWhitelistAddress = removeWhitelistAddress;
window.toggleAdminPanel = () => {
    const panel = document.getElementById("adminSection");
    panel.style.display = panel.style.display === "none" ? "block" : "none";
};

window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeEditModal();
    if (event.key === "Enter" && document.getElementById("editCandidateSection").style.display === "block") {
        saveCandidateEdit();
    }
});

init();
