const db = require('../config/db');

class CoordinatorModel {
    
    // GET ALL
    static async getAllSemesters() {
        const query = `SELECT * FROM semesters ORDER BY start_date DESC`;
        const [rows] = await db.execute(query);
        return rows;
    }

    // CREATE
    static async createSemester(data) {
        // Jika user set aktif, matikan dulu semester lain
        if (data.is_active) {
            await db.execute(`UPDATE semesters SET is_active = FALSE`);
        }

        const query = `
            INSERT INTO semesters 
            (name, year, start_date, end_date, uts_start_date, uts_end_date, uas_start_date, uas_end_date, min_ta1, min_ta2, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            data.name, data.year, data.start_date, data.end_date,
            data.uts_start, data.uts_end, data.uas_start, data.uas_end,
            data.min_ta1, data.min_ta2, data.is_active
        ];
        
        await db.execute(query, params);
        return true;
    }

    // UPDATE
    static async updateSemester(id, data) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            if (data.is_active) {
                await connection.execute(`UPDATE semesters SET is_active = FALSE`);
            }

            const query = `
                UPDATE semesters SET 
                    name=?, year=?, start_date=?, end_date=?, 
                    uts_start_date=?, uts_end_date=?, uas_start_date=?, uas_end_date=?, 
                    min_ta1=?, min_ta2=?, is_active=?
                WHERE semester_id=?
            `;
            const params = [
                data.name, data.year, data.start_date, data.end_date,
                data.uts_start, data.uts_end, data.uas_start, data.uas_end,
                data.min_ta1, data.min_ta2, data.is_active, id
            ];
            
            await connection.execute(query, params);
            await connection.commit();
            return true;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }

    // DELETE
    static async deleteSemester(id) {
        // Cek dulu apakah ada data thesis/jadwal yang terikat agar tidak error constraint
        // Untuk MVP kita delete saja langsung (Soft delete recommended sebenernya)
        await db.execute(`DELETE FROM semesters WHERE semester_id = ?`, [id]);
        return true;
    }

    // SET ACTIVE TOGGLE
    static async setActive(id) {
        const connection = await db.getConnection();
        await connection.beginTransaction();
        try {
            await connection.execute(`UPDATE semesters SET is_active = FALSE`);
            await connection.execute(`UPDATE semesters SET is_active = TRUE WHERE semester_id = ?`, [id]);
            await connection.commit();
            return true;
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }
    }
}

module.exports = CoordinatorModel;