(function () {
    if (typeof MaintenanceApp === 'undefined') return;
    class MaintenancePhotoExportMethods extends MaintenanceApp {
        getPhotoManagerExportZipFileName() {
            const now = new Date();
            const stamp = [
                now.getFullYear(),
                String(now.getMonth() + 1).padStart(2, '0'),
                String(now.getDate()).padStart(2, '0')
            ].join('');
            return `photo_manager_${stamp}.zip`;
        }

        getPhotoManagerUniqueExportFileName(name, used) {
            const clean = String(name || 'photo').replace(/[\\/:*?"<>|]/g, '_') || 'photo';
            const dot = clean.lastIndexOf('.');
            const base = dot > 0 ? clean.slice(0, dot) : clean;
            const ext = dot > 0 ? clean.slice(dot) : '';
            let candidate = clean;
            let count = 2;
            while (used.has(candidate.toLowerCase())) {
                candidate = `${base}_${count}${ext}`;
                count += 1;
            }
            used.add(candidate.toLowerCase());
            return candidate;
        }

        dataUrlToPhotoManagerBytes(src = '') {
            const text = String(src || '');
            const comma = text.indexOf(',');
            if (!text.startsWith('data:') || comma < 0) throw new Error('逕ｻ蜒上ョ繝ｼ繧ｿ繧定ｪｭ縺ｿ霎ｼ繧√∪縺帙ｓ縺ｧ縺励◆');
            const header = text.slice(0, comma);
            const body = text.slice(comma + 1);
            if (/;base64/i.test(header)) {
                const binary = atob(body);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
                return bytes;
            }
            return new TextEncoder().encode(decodeURIComponent(body));
        }

        getPhotoManagerCrc32(bytes) {
            if (!this._photoManagerCrcTable) {
                this._photoManagerCrcTable = new Uint32Array(256);
                for (let i = 0; i < 256; i += 1) {
                    let c = i;
                    for (let j = 0; j < 8; j += 1) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
                    this._photoManagerCrcTable[i] = c >>> 0;
                }
            }
            let crc = 0xffffffff;
            for (let i = 0; i < bytes.length; i += 1) {
                crc = this._photoManagerCrcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
            }
            return (crc ^ 0xffffffff) >>> 0;
        }

        pushPhotoManagerZip16(parts, value) {
            parts.push(value & 0xff, (value >>> 8) & 0xff);
        }

        pushPhotoManagerZip32(parts, value) {
            parts.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff);
        }

        createPhotoManagerZipBlob(files) {
            const encoder = new TextEncoder();
            const chunks = [];
            const central = [];
            let offset = 0;
            const now = new Date();
            const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
            const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();

            files.forEach(file => {
                const nameBytes = encoder.encode(file.name);
                const data = file.bytes;
                const crc = this.getPhotoManagerCrc32(data);
                const local = [];
                this.pushPhotoManagerZip32(local, 0x04034b50);
                this.pushPhotoManagerZip16(local, 20);
                this.pushPhotoManagerZip16(local, 0x0800);
                this.pushPhotoManagerZip16(local, 0);
                this.pushPhotoManagerZip16(local, dosTime);
                this.pushPhotoManagerZip16(local, dosDate);
                this.pushPhotoManagerZip32(local, crc);
                this.pushPhotoManagerZip32(local, data.length);
                this.pushPhotoManagerZip32(local, data.length);
                this.pushPhotoManagerZip16(local, nameBytes.length);
                this.pushPhotoManagerZip16(local, 0);
                chunks.push(new Uint8Array(local), nameBytes, data);

                const entryOffset = offset;
                offset += local.length + nameBytes.length + data.length;

                const header = [];
                this.pushPhotoManagerZip32(header, 0x02014b50);
                this.pushPhotoManagerZip16(header, 20);
                this.pushPhotoManagerZip16(header, 20);
                this.pushPhotoManagerZip16(header, 0x0800);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip16(header, dosTime);
                this.pushPhotoManagerZip16(header, dosDate);
                this.pushPhotoManagerZip32(header, crc);
                this.pushPhotoManagerZip32(header, data.length);
                this.pushPhotoManagerZip32(header, data.length);
                this.pushPhotoManagerZip16(header, nameBytes.length);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip16(header, 0);
                this.pushPhotoManagerZip32(header, 0);
                this.pushPhotoManagerZip32(header, entryOffset);
                central.push(new Uint8Array(header), nameBytes);
            });

            const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
            const end = [];
            this.pushPhotoManagerZip32(end, 0x06054b50);
            this.pushPhotoManagerZip16(end, 0);
            this.pushPhotoManagerZip16(end, 0);
            this.pushPhotoManagerZip16(end, files.length);
            this.pushPhotoManagerZip16(end, files.length);
            this.pushPhotoManagerZip32(end, centralSize);
            this.pushPhotoManagerZip32(end, offset);
            this.pushPhotoManagerZip16(end, 0);
            return new Blob([...chunks, ...central, new Uint8Array(end)], { type: 'application/zip' });
        }

        async exportPhotoManagerItemsAsZip(items) {
            const used = new Set();
            const files = [];
            for (let index = 0; index < items.length; index += 1) {
                const item = items[index];
                const src = await this.getPhotoManagerDownloadSrc(item);
                const name = this.getPhotoManagerUniqueExportFileName(
                    this.getPhotoManagerSafeFileName(item, index + 1, src),
                    used
                );
                files.push({ name, bytes: this.dataUrlToPhotoManagerBytes(src) });
            }
            const blob = this.createPhotoManagerZipBlob(files);
            this.downloadPhotoManagerBlob(blob, this.getPhotoManagerExportZipFileName());
            this.showToast?.(`${items.length}件の画像をZIPで出力しました。`, 'success');
        }

    }
    for (const name of Object.getOwnPropertyNames(MaintenancePhotoExportMethods.prototype)) {
        if (name !== 'constructor') MaintenanceApp.prototype[name] = MaintenancePhotoExportMethods.prototype[name];
    }
})();
