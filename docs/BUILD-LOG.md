# บันทึกการสร้าง Roombook

บันทึกนี้เป็นลำดับการสร้างโปรเจกต์ช่วง **19–20 พฤศจิกายน 2026 ตามเวลาไทย** พร้อมตัวอย่างที่ลองซ้ำได้จากโฟลเดอร์โปรเจกต์ใน **PowerShell บน Windows** คำสั่งในหัวข้อการเริ่มใช้งานและ Git มีตัวอย่างสำหรับใช้ต่อ ส่วนผลการทดสอบที่เกิดขึ้นจริงระบุไว้ในแต่ละช่วง

## 1. ตรวจ repo ก่อนเริ่ม

```powershell
Get-ChildItem -Force -Name
git status --short --branch
git remote -v
git fetch origin
git ls-remote --symref origin
```

- `Get-ChildItem -Force -Name` ดูชื่อไฟล์และโฟลเดอร์รวมถึง `.git` ที่ซ่อนอยู่ ช่วยให้เห็นว่าเริ่มจาก repo ที่ initialize แล้วหรือจากโฟลเดอร์ธรรมดา
- `git status --short --branch` ดู branch และสถานะไฟล์แบบย่อ `??` หมายถึงไฟล์ยังไม่ถูก track และ `No commits yet` หมายถึง branch ยังไม่มี commit แรก
- `git remote -v` ดู URL ที่ใช้ fetch และ push เพื่อยืนยันว่ากำลังทำงานกับ repo ที่ตั้งใจ
- `git fetch origin` ดาวน์โหลดข้อมูล Git และอัปเดต remote-tracking refs ในเครื่อง ใช้เมื่อต้องการตรวจว่าฝั่ง GitHub มีงานให้ดึงมาหรือยัง
- `git ls-remote --symref origin` อ่าน refs จาก GitHub โดยตรง พร้อมปลายทางของ symbolic refs เช่น `HEAD` ถ้า remote มีข้อมูล คำสั่งนี้จบสำเร็จโดยผลลัพธ์ว่างเมื่อสำรวจครั้งแรก จึงเริ่มสร้างไฟล์ใน working tree เดิมได้

**ผลที่พบ** `origin` ชี้ไปที่ `prapat-psm/becoming-fullstack` และ `main` ยังไม่มี commit ณ ตอนเพิ่มบันทึกนี้ ยังไม่มีการ commit, push หรือเปิด PR/MR

## 2. ตรวจเครื่องและติดตั้ง dependencies

```powershell
node -v
npm.cmd --version
docker --version
docker info --format '{{.ServerVersion}}'
npm.cmd ping --fetch-retries=0
npm.cmd install --cache .npm-cache --fetch-retries=1
```

- `node -v` และ `npm.cmd --version` ตรวจ runtime กับ package manager โปรเจกต์กำหนด Node.js 24 เครื่องนี้เรียก `npm.cmd` เพราะ PowerShell ปฏิเสธ `npm.ps1` ตอนเรียก `npm` โดยตรง
- `docker --version` ตรวจว่ามี Docker CLI แล้ว ส่วน `docker info --format '{{.ServerVersion}}'` ตรวจว่าคุยกับ Docker Engine ได้จริง จึงแยกกรณีติดตั้ง CLI แล้วแต่ Engine ยังไม่ทำงานได้
- `npm.cmd ping --fetch-retries=0` ทดสอบว่า npm ติดต่อ registry ได้โดยไม่รอ retry หลายรอบ ตอนแรกพบ `ENOTFOUND` ในสภาพแวดล้อมที่จำกัดเครือข่าย จึงรันการติดตั้งอีกครั้งด้วยสิทธิ์เข้าถึงเครือข่ายในเซสชันนั้น
- `npm.cmd install --cache .npm-cache --fetch-retries=1` ใช้ตอนสร้างโปรเจกต์เพื่อแก้ dependency versions จาก `package.json` และสร้าง `package-lock.json` โดยเก็บ cache ใน workspace การติดตั้งครั้งถัดไปให้ใช้ `npm.cmd ci` เพื่อยึด lockfile แบบเดียวกับ CI และ Docker

## 3. สร้างแอปและรันจากฐานข้อมูลว่าง

สร้าง NestJS REST API และ React UI ที่เสิร์ฟจาก origin เดียวกัน เขียน SQL migration และ seed บัญชีตัวอย่าง แยกสิทธิ์สมาชิกกับผู้ดูแล แล้วเพิ่ม PostgreSQL exclusion constraint เพื่อป้องกันการจองห้องเดียวกันในช่วงเวลาที่ทับกัน

```powershell
Copy-Item .env.example .env
docker compose up -d --wait db
npm.cmd ci
npm.cmd run db:migrate
npm.cmd run db:seed
npm.cmd run build
npm.cmd start
```

- `Copy-Item .env.example .env` สร้าง config สำหรับเครื่องตัวเองจากค่าตัวอย่าง ใช้ครั้งแรกเมื่อยังไม่มี `.env` คำสั่งจะแทนที่ไฟล์ปลายทางถ้ามีอยู่แล้ว
- `docker compose up -d --wait db` เปิดเฉพาะ PostgreSQL แบบเบื้องหลัง `--wait` รอ health check ก่อนให้ทำขั้นถัดไป
- `npm.cmd ci` ติดตั้ง dependencies ตาม `package-lock.json` เหมาะกับการรันจาก checkout ใหม่และใช้ซ้ำใน CI
- `npm.cmd run db:migrate` ใช้ SQL migrations ตามลำดับ บันทึกไฟล์ที่ใช้แล้วพร้อม checksum และใช้ advisory lock ป้องกันสองโปรเซสใช้ migration พร้อมกัน รันซ้ำแล้ว migration เดิมจะถูกข้าม
- `npm.cmd run db:seed` สร้างห้องและบัญชีตัวอย่างในฐานข้อมูลที่ตั้งไว้ ใช้รหัสผ่านสมาชิกและผู้ดูแลคนละค่า การ seed ซ้ำจะตั้งรหัสจากค่า config ปัจจุบันและเพิกถอน session ของสองบัญชีตัวอย่าง
- `npm.cmd run build` ให้ TypeScript ตรวจ backend และ frontend แล้วให้ Vite สร้างไฟล์ frontend ใน `dist/web` ส่วนโค้ด NestJS ที่ compile แล้วอยู่ใน `dist/server`
- `npm.cmd start` เปิด backend ที่เสิร์ฟ API และหน้าเว็บ ใช้ `http://127.0.0.1:3000` ในเบราว์เซอร์ กด `Ctrl+C` ในเทอร์มินัลเดิมเพื่อหยุดโปรเซส

**ถ้าแก้โค้ดระหว่างพัฒนา** ใช้ `npm.cmd run dev:api` กับ `npm.cmd run dev:web` คนละเทอร์มินัล คำสั่งแรกให้ `tsx watch` โหลด backend ใหม่เมื่อไฟล์เปลี่ยน คำสั่งหลังเปิด Vite พร้อม proxy `/api` ไปที่ backend พอร์ต `3000` ให้เปิด URL ที่ Vite แสดง

## 4. ทดสอบ PostgreSQL และตรวจผล

ช่วงแรก Docker Engine ยังไม่พร้อม จึงใช้ PostgreSQL 17 ที่ติดตั้งบน Windows และเปิด cluster ชั่วคราวแยกบน loopback พอร์ต `55433` การทดสอบทางเลือกนี้ใช้เครื่องมือคนละส่วนดังนี้

- `initdb -D <data-dir> -U roombook --auth=scram-sha-256 --pwprompt --encoding=UTF8 --locale=C` สร้าง cluster ใหม่ในโฟลเดอร์ที่ระบุ `-U` ตั้งชื่อ database user, `--auth` ตั้งวิธีตรวจรหัส และ `--pwprompt` ให้พิมพ์รหัสผ่านตอนรัน ครั้งจริงใช้ `--pwfile` กับไฟล์ชั่วคราวของชุดทดสอบ
- `postgres -D <data-dir> -h 127.0.0.1 -p 55433` เปิด cluster ที่สร้างไว้ เฉพาะ loopback และพอร์ตทดสอบ เลือกใช้ executable จาก `bin` ของ PostgreSQL หากเครื่องยังไม่ได้เพิ่มไว้ใน PATH
- `pg_isready -h 127.0.0.1 -p 55433` เช็กว่าโปรเซสรับการเชื่อมต่อแล้ว ก่อนเรียก `npm.cmd test` ครั้งแรกที่ทดสอบข้าม sandbox ถูกปฏิเสธการเชื่อมต่อ จึงเปิด cluster และทดสอบภายใต้สิทธิ์เครือข่ายที่ตรงกัน
- `pg_ctl -D <data-dir> -m fast -w stop` ปิด cluster ชั่วคราวโดยตัดการเชื่อมต่อและยกเลิก transaction ที่ยังทำงาน แล้วรอจนหยุด ใช้กับ data directory ของชุดทดสอบเท่านั้น

สำหรับการทดสอบซ้ำด้วยฐานข้อมูลตาม [README](../README.md) ใช้คำสั่งต่อไปนี้

```powershell
npm.cmd run build
npm.cmd test
npm.cmd run db:explain
Invoke-RestMethod -Uri 'http://127.0.0.1:3000/api/health'
```

- `npm.cmd test` ใช้ `TEST_DATABASE_URL` และ HTTP integration tests กับฐานข้อมูลจริง สร้าง schema ชั่วคราวของชุดทดสอบและเก็บกวาดตอนจบ ตัวอย่างการอ่านผลคือ `pass 6` และ `fail 0`
- `npm.cmd run db:explain` ใช้ `DATABASE_URL` เพื่อเรียก `EXPLAIN (ANALYZE, BUFFERS)` กับ query หาห้องว่าง ใช้ดูว่า planner เลือก index ใดและอ่าน buffer เท่าไร ผลบนข้อมูลตัวอย่างไม่ควรนำไปประมาณประสิทธิภาพบนข้อมูล production
- `Invoke-RestMethod` เรียก health endpoint ของแอปที่เปิดอยู่และแปลง JSON เป็น PowerShell object เมื่อพร้อมจะเห็น `status` เป็น `ok`

**ผลที่ตรวจจริง** คำขอจองชนกันสองคำขอได้ `201` กับ `409` ตามที่ต้องการ ทดสอบสิทธิ์และการกู้คืนเมื่อ schema ไม่ตรงแล้วผ่าน ลองจองห้อง Atlas และยกเลิกผ่านเบราว์เซอร์สำเร็จ ส่วน `EXPLAIN` บนข้อมูลตัวอย่างเลือกใช้ GiST index สำหรับค้นหาการจองที่ทับกัน

## 5. สร้าง Docker image และซ้อม rollback ในเครื่อง

ตัวอย่างด้านล่างแยก Compose project และพอร์ตจากเดโมปกติ ค่าพอร์ตสองตัวมีผลกับ PowerShell session ที่ตั้งค่าไว้

```powershell
docker desktop start --detach
$env:ROOMBOOK_HOST_PORT = '3300'
$env:POSTGRES_HOST_PORT = '55434'
docker compose -p roombook-verify --profile app config --quiet
docker compose -p roombook-verify --profile app up --build -d --wait
docker compose -p roombook-verify exec -T app npm run db:seed
Invoke-RestMethod -Uri 'http://127.0.0.1:3300/api/rooms'
docker compose -p roombook-verify logs --tail 12 app
docker compose -p roombook-verify --profile app down
```

- `docker desktop start --detach` ใช้เมื่อ Engine ยังไม่ทำงาน เปิด Docker Desktop โดยคืน control ให้เทอร์มินัลก่อน
- `docker compose -p roombook-verify --profile app config --quiet` ตรวจว่า Compose อ่าน YAML และแทนค่าตัวแปรได้ `-p` ตั้งชื่อโปรเจกต์แยก `--profile app` เปิดใช้ service เว็บ และ `--quiet` ให้ดูแค่ exit code
- `up --build -d --wait` สร้าง image จาก `Dockerfile` เปิด services เบื้องหลัง และรอ health check ส่วน `exec -T app npm run db:seed` รัน seed ใน container ที่เปิดแล้วโดยไม่ต้องจัดสรร terminal
- `Invoke-RestMethod .../api/rooms` เป็น smoke check ว่าแอปอ่านห้องจากฐานข้อมูลได้ หลัง seed ผลที่คาดคือห้องตัวอย่างสามห้อง
- `logs --tail 12 app` อ่าน log ของ service แอปล่าสุด 12 บรรทัด ใช้หาเหตุ startup หรือ deploy ล้มเหลว
- `down` หยุดและลบ container กับ network ของโปรเจกต์นี้ โดยค่าเริ่มต้นจะเก็บ volume ฐานข้อมูลไว้

**rollback ที่ซ้อมจริง** ป้อน Compose override ผ่าน `-f compose.yaml -f -` เพื่อเปลี่ยนพอร์ตภายใน `DATABASE_URL` ให้ผิด แล้วใช้ `up -d --force-recreate --no-deps --wait app` เพื่อสร้างเฉพาะ container แอปใหม่ พบ `ECONNREFUSED` ใน log จากนั้นใช้คำสั่งเดิมกับ config ปกติและตรวจ `/api/health` กับ `/api/rooms` อีกครั้ง แอปกลับมา healthy และห้องตัวอย่างทั้งสามยังอยู่ การซ้อมนี้ทำบน Docker ในเครื่อง ขั้นตอนสำหรับ Render อยู่ใน [runbook](OPERATIONS.md)

ตัวอย่างนี้ใช้ค่าฐานข้อมูลตัวอย่างและรันก่อน `down` ในคำสั่งชุดบน

```powershell
$badRelease = @'
services:
  app:
    environment:
      DATABASE_URL: postgres://roombook:roombook-local@db:65432/roombook
'@
$badRelease | docker compose -p roombook-verify -f compose.yaml -f - --profile app up -d --force-recreate --no-deps --wait --wait-timeout 15 app
docker compose -p roombook-verify logs --tail 12 app
docker compose -p roombook-verify --profile app up -d --force-recreate --no-deps --wait app
Invoke-RestMethod -Uri 'http://127.0.0.1:3300/api/health'
```

`@'` กับ `'@` คือ PowerShell here-string สำหรับเก็บ YAML หลายบรรทัด `-f -` อ่าน override จาก stdin `--force-recreate` สร้าง container ใหม่ และ `--no-deps` ให้คง PostgreSQL ที่กำลังรันไว้ สเต็ปปล่อย config ผิดควรได้ exit code ที่ไม่ใช่ `0` ส่วนสเต็ปคืน config ปกติควรเห็น health เป็น `ok`

## 6. ตัวอย่างคำสั่ง Git สำหรับทำงานต่อ

เมื่อมี `main` บน remote แล้ว ตัวอย่างงานย่อยหนึ่งชิ้นใช้ลำดับนี้

```powershell
git switch -c codex/booking-docs
git status --short
git add -- README.md docs/BUILD-LOG.md
git diff --cached
git commit -m "Document the Roombook build and verification"
git log -1 --format=%B
git push -u origin codex/booking-docs
```

- `git switch -c` สร้างและสลับไป branch งานจาก commit ปัจจุบัน โปรเจกต์ที่ยังไม่มี commit แรกต้องมี base branch บน remote ก่อนเปิด PR/MR ได้
- `git status --short` ดูรายการไฟล์ก่อนเลือก ส่วน `git add --` ระบุเฉพาะไฟล์ที่จะ stage `--` คั่น options ออกจาก path
- `git diff --cached` ตรวจสิ่งที่ stage ไว้ก่อน commit ใช้ดูว่าเลือกไฟล์ครบและมีเฉพาะ diff ที่ตั้งใจส่ง
- `git commit -m` สร้าง commit จาก staged changes ด้วยข้อความที่กำหนด ตัวอย่างนี้ใช้ข้อความสั้นที่บอกว่าส่งมอบอะไร และใช้กฎ attribution ของ repo [AGENTS.md](../AGENTS.md)
- `git log -1 --format=%B` อ่านข้อความเต็มของ commit ล่าสุด รวม body และ trailers ใช้ตรวจข้อความจริงก่อน push
- `git push -u origin codex/booking-docs` ส่ง branch งานและตั้ง upstream ให้ `git push` หรือ `git pull` ครั้งถัดไปอ้างอิง branch ได้ จากนั้นเปิด PR บน GitHub หรือ MR บน GitLab ไปยัง base branch และสรุปสิ่งที่เปลี่ยนกับวิธีทดสอบใน description ตามกฎเดียวกัน
