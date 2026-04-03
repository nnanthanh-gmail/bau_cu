# Đã hoàn thiện các chức năng còn thiếu/chưa hoàn thiện

## Đã bổ sung trong code

- Bỏ phiếu nhiều người trong 1 đợt (giới hạn số lượng chọn)
- Lưu lịch sử từng đợt bầu cử
- Hiển thị hash giao dịch thật từ event `VoteCast`
- Kết nối MetaMask bằng nút riêng
- Quản lý whitelist đầy đủ hơn: thêm + xem + gỡ
- Xem danh sách cử tri đã đăng ký
- Ảnh ứng cử viên bằng URL
- Dừng bầu cử thủ công và xem lại lịch sử round

## File đã sửa

- `contracts/voting.sol`
- `abi.js`
- `app.js`
- `index.html`
- `style.css`

## Việc bắt buộc sau khi lấy zip

1. Deploy lại contract mới
2. Lấy địa chỉ contract mới
3. Mở `app.js`
4. Thay:

```js
const contractAddress = "REPLACE_WITH_NEW_DEPLOYED_CONTRACT_ADDRESS";
```

thành địa chỉ contract mới vừa deploy

## Lưu ý

Bản zip này chưa có backend PostgreSQL, nên ảnh ứng cử viên hiện đang làm theo hướng lưu URL ảnh trong contract/giao diện để chạy được ngay theo kiến trúc hiện tại.
