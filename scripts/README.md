# Backend Scripts

## assignCinemaToStaff.js

Script để gán `cinemaId` cho staff accounts hiện có trong database.

### Cách chạy

#### Option 1: Dùng .env file (Khuyên dùng)

```bash
# Tạo file .env trong backend/ nếu chưa có
# Thêm dòng: MONGO_URI=mongodb://...

cd backend
node scripts/assignCinemaToStaff.js
```

#### Option 2: Truyền MONGO_URI qua environment variable

**Windows PowerShell:**
```powershell
cd backend
$env:MONGO_URI="mongodb://localhost:27017/rapphim"; node scripts/assignCinemaToStaff.js
```

**Windows CMD:**
```cmd
cd backend
set MONGO_URI=mongodb://localhost:27017/rapphim && node scripts/assignCinemaToStaff.js
```

**Linux/Mac:**
```bash
cd backend
MONGO_URI="mongodb://localhost:27017/rapphim" node scripts/assignCinemaToStaff.js
```

#### Option 3: Dùng local MongoDB (mặc định)

```bash
cd backend
node scripts/assignCinemaToStaff.js --local
```

Sẽ connect tới: `mongodb://localhost:27017/rapphim`

### Output mẫu

```
🔌 Connecting to MongoDB...
✅ Connected to MongoDB
📍 Found 3 cinemas
👥 Found 2 staff without cinemaId

🎬 Assigning all staff to: CGV Vincom Center
  ✓ Assigned staff@cinema.com to CGV Vincom Center
  ✓ Assigned staff2@cinema.com to CGV Vincom Center

✅ Successfully assigned 2 staff to cinema

💡 TIP: Nếu muốn gán staff cho các cinema khác:
   1. Vào admin panel
   2. Edit user và chọn cinema
   3. Hoặc modify script này để custom assignment
```

### Lưu ý

- Script sẽ gán **tất cả staff chưa có cinemaId** vào **cinema đầu tiên** trong database
- Nếu muốn gán vào cinema khác, có thể:
  - Chỉnh sửa script (line 76: `const defaultCinema = cinemas[0]`)
  - Hoặc dùng admin panel để update sau
- Script an toàn: chỉ update staff chưa có cinemaId, không ảnh hưởng staff đã có

### Troubleshooting

**Lỗi: "MONGO_URI not found"**
- Kiểm tra file .env có tồn tại không
- Kiểm tra MONGO_URI có đúng format không
- Thử dùng `--local` flag nếu dùng MongoDB local

**Lỗi: "No cinemas found"**
- Database chưa có cinema nào
- Tạo cinema trước qua admin panel hoặc seed data

**Lỗi: "Connection refused"**
- MongoDB server chưa chạy
- Check MONGO_URI có đúng không
- Nếu dùng local, start MongoDB: `mongod`
