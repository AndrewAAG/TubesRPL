// File: test/models/schedule.test.js

const db = require('../../config/db');
const ScheduleModel = require('../../models/scheduleModel');

// CRITICAL STEP: Mock the database module to prevent real database interaction
jest.mock('../../config/db', () => ({
    execute: jest.fn(), // Mock for simple db.execute calls
    getConnection: jest.fn(), // Mock for transaction setup
}));

// Define the Mock Connection object for transactions (used in reschedule, updateStatus)
const mockConnection = {
    // Spies for transaction methods
    beginTransaction: jest.fn(),
    execute: jest.fn(),
    commit: jest.fn(),
    rollback: jest.fn(),
    release: jest.fn(),
};

// Setup: Before each test, ensure db.getConnection returns our controlled mock
beforeEach(() => {
    jest.clearAllMocks(); // Resets call counts for all spies before each test
    db.getConnection.mockResolvedValue(mockConnection);
});

// Start of the Test Suite
describe('ScheduleModel Tests', () => {
    // Your tests will go here!

    it('should rollback the transaction and throw an error if a query fails (White-Box)', async () => {
        // ARRANGE: Setup the inputs
        const appId = 7;
        const newStart = '2026-01-01 10:00:00';
        const newEnd = '2026-01-01 11:00:00';
        const reason = 'Test Failure';
        const mockError = new Error('Simulated Database Failure');

        // ARRANGE: Make the FIRST database operation fail
        mockConnection.execute.mockRejectedValueOnce(mockError);

        // ACT & ASSERT: Call the function and expect it to throw the error
        await expect(
            ScheduleModel.reschedule(appId, newStart, newEnd, reason)
        ).rejects.toThrow(mockError);

        // ASSERT (White-Box Structure): Check transaction flow cleanup
        expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(mockConnection.commit).not.toHaveBeenCalled();
        expect(mockConnection.release).toHaveBeenCalledTimes(1);
    });

    it('should successfully update appointment times and commit the transaction (Black-Box)', async () => {
        // ARRANGE: Setup mock DB to return success for all execute calls
        mockConnection.execute.mockResolvedValue([{}]);
        
        const appId = 11;
        const newStart = '2026-01-05 10:00:00';
        const newEnd = '2026-01-05 11:00:00';
        const reason = 'Moved to Monday.';

        // ACT
        const result = await ScheduleModel.reschedule(appId, newStart, newEnd, reason);

        // ASSERT (Black-Box): Check the final external result
        expect(result).toBe(true);
        
        // ASSERT (White-Box/Structure): Check transaction flow
        expect(mockConnection.commit).toHaveBeenCalledTimes(1); // Crucial check for success path
        expect(mockConnection.rollback).not.toHaveBeenCalled();

        // ASSERT (White-Box/Logic): Verify the parameters used in the main UPDATE query
        expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE appointments"),
            [newStart, newEnd, reason, appId]
        );
    });

    it('should include the reschedule reason in the notes field in the update query (White-Box)', async () => {
        // ARRANGE: Setup mock DB to return success
        mockConnection.execute.mockResolvedValue([{}]);
        
        const appId = 12;
        const newStart = '2026-01-06 09:00:00';
        const newEnd = '2026-01-06 10:00:00';
        const reason = 'Dosen ada rapat mendadak.'; // The reason we want to verify

        // ACT
        await ScheduleModel.reschedule(appId, newStart, newEnd, reason);

        // ASSERT (White-Box): Check that the FIRST connection.execute call (UPDATE appointments)
        // contains the expected CONCAT string for the notes field.
        expect(mockConnection.execute).toHaveBeenCalledWith(
            // Use regex to check that the query string contains the correct CONCAT/notes logic
            expect.stringMatching(/notes = CONCAT\(IFNULL\(notes, ''\), ' \[Reschedule: ', \?, '\]'\)/),
            [newStart, newEnd, reason, appId]
        );
        
        // Assert commitment for completeness
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should update appointment status to rejected, append notes, and update pivot status (White-Box Rejected)', async () => {
        // ARRANGE: Setup inputs and ensure mock DB returns success
        mockConnection.execute.mockResolvedValue([{}]);
        
        const appId = 20;
        const status = 'rejected';
        const notes = 'Waktu tidak cocok.';
        const lecturerId = 501; // Necessary to hit the lecturerId branch

        // ACT
        const result = await ScheduleModel.updateStatus(appId, status, notes, lecturerId);

        // ASSERT (Black-Box): Final result
        expect(result).toBe(true);
        
        // ASSERT (White-Box/Branch A): Verify the complex CONCAT query was used
        expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining("notes = CONCAT(IFNULL(notes, ''), ' [Ditolak: ', ?, ']')"),
            [status, notes, appId]
        );

        // ASSERT (White-Box/Logic): Verify the pivot table update (Branch: if lecturerId)
        expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE appointment_lecturers"),
            ['rejected', appId, lecturerId] // lecturerStatus should be 'rejected'
        );
        
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should update appointment status to approved using simple query and update pivot status (Black-Box Approved)', async () => {
        // ARRANGE: Setup inputs and ensure mock DB returns success
        mockConnection.execute.mockResolvedValue([{}]);
        
        const appId = 21;
        const status = 'approved';
        const lecturerId = 502; // Necessary to hit the lecturerId branch

        // ACT
        const result = await ScheduleModel.updateStatus(appId, status, null, lecturerId);

        // ASSERT (Black-Box): Final result
        expect(result).toBe(true);
        
        // ASSERT (White-Box/Branch B): Verify the simple UPDATE query was used
        // This is the path taken when the 'rejected' IF condition is false.
        expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE appointments SET status = ? WHERE app_id = ?"),
            [status, appId]
        );
        
        // ASSERT (White-Box/Logic): Verify the pivot table update
        expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE appointment_lecturers"),
            ['accepted', appId, lecturerId] // lecturerStatus should be 'accepted'
        );
        
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should delete old schedules and perform bulk insert for new schedules (Black-Box)', async () => {
        // ARRANGE: Setup inputs for schedules
        const studentId = 300;
        const schedules = [
            { day: 'Senin', start: '08:00:00', end: '09:40:00', course: 'Basis Data' },
            { day: 'Selasa', start: '10:00:00', end: '11:40:00', course: 'Struktur Data' }
        ];
        
        // Mock the three internal execute calls in order:
        // 1. DELETE query
        mockConnection.execute.mockResolvedValueOnce([{}]);
        // 2. SELECT semester_id
        mockConnection.execute.mockResolvedValueOnce([[{ semester_id: 5 }]]);
        // 3. INSERT query
        mockConnection.execute.mockResolvedValueOnce([{}]);

        // ACT
        const result = await ScheduleModel.replaceStudentSchedule(studentId, schedules);

        // ASSERT (Black-Box): Final result
        expect(result).toBe(true);
        
        // ASSERT (White-Box/Logic): Verify the DELETE query (Call 1)
        expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining("DELETE FROM student_schedules WHERE student_id = ?"),
            [studentId]
        );
        
        // ASSERT (White-Box/Logic): Verify the INSERT query (Call 3) and its parameters
        expect(mockConnection.execute).toHaveBeenCalledWith(
            // 1. Check the QUERY STRING (Argument 1 of the INSERT call)
            expect.stringContaining("INSERT INTO student_schedules"),
            
            // 2. Check the PARAMETERS ARRAY (Argument 2 of the INSERT call)
            // This verifies the logic correctly compiled the array of 12 parameters.
            expect.arrayContaining(schedules.flatMap(s => [
                studentId, 5, s.day, s.start, s.end, s.course
            ]))
        );

        // Check that the INSERT query was the 3rd connection.execute call
        // We ensure the DELETE and SELECT calls happened before the INSERT
        expect(mockConnection.execute).toHaveBeenCalledTimes(3); 
        
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should only delete old schedules and commit if the new schedule list is empty (White-Box Branch)', async () => {
        // ARRANGE
        const studentId = 301;
        const schedules = []; // Empty array triggers the branch skip
        
        // Mock the single execute call (DELETE)
        mockConnection.execute.mockResolvedValueOnce([{}]);

        // ACT
        const result = await ScheduleModel.replaceStudentSchedule(studentId, schedules);

        // ASSERT (Black-Box): Final result
        expect(result).toBe(true);

        // ASSERT (White-Box/Branch): Verify that the bulk INSERT was NOT called
        // The mockConnection.execute should only be called for DELETE
        expect(mockConnection.execute).toHaveBeenCalledTimes(1); 
        
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should retrieve and correctly format all appointments for a student', async () => {
        // ARRANGE: Setup mock for the non-transactional db.execute
        const studentId = 1001;
        
        // Mock the expected database result (Note the columns match the SQL query)
        const mockDbResult = [
            {
                id: 1,
                start_time: '2025-12-15 10:00:00',
                end_time: '2025-12-15 11:00:00',
                status: 'approved',
                location: 'Zoom',
                mode: 'online',
                notes: 'Chapter 1 review',
                lecturers: 'Dr. Smith, Prof. Jones',
                lecturer_ids: '501,502'
            }
        ];
        
        // CRITICAL: We mock the top-level db.execute, NOT mockConnection.execute
        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getByStudentId(studentId);

        // ASSERT (Black-Box): Check the final external result structure and content
        expect(result).toEqual(mockDbResult);
        expect(result.length).toBe(1);
        
        // ASSERT (White-Box): Verify the correct query was executed
        expect(db.execute).toHaveBeenCalledWith(
            // Check that the main table joins and WHERE clause are in the query
            expect.stringContaining("FROM appointments a"),
            [studentId]
        );
    });

    it('should throw an error if the database query fails (getByStudentId Catch)', async () => {
        // ARRANGE: Setup the mock to reject the promise
        const studentId = 1002;
        const mockError = new Error('SQL connection refused.');
        
        // CRITICAL: Mock the top-level db.execute to fail
        db.execute.mockRejectedValueOnce(mockError);

        // ACT & ASSERT: Call the function and expect it to throw the mocked error
        await expect(
            ScheduleModel.getByStudentId(studentId)
        ).rejects.toThrow(mockError);
        
        // ASSERT (White-Box): Verify the function was called with the correct ID
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("FROM appointments a"),
            [studentId]
        );
    });

    it('should retrieve pending appointments for a specific lecturer with student details', async () => {
        // ARRANGE
        const lecturerId = 5001;
        
        const mockDbResult = [
            {
                id: 10,
                start_time: '2026-03-01 14:00:00',
                status: 'pending',
                topic: 'Revisi Bab 3',
                student_name: 'Budi Santoso',
                npm: '123456789',
                stage_type: 'TA1' 
            }
        ];
        
        // Mock the top-level db.execute
        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getPendingByLecturer(lecturerId);

        // ASSERT (Black-Box): Check data content and structure
        expect(result).toEqual(mockDbResult);
        expect(result[0].status).toBe('pending');
        
        // ASSERT (White-Box): Verify the correct query and parameters were executed
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("FROM appointments a"),
            [lecturerId]
        );
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("AND a.status = 'pending'"),
            expect.any(Array) // Check only the query string
        );
    });

    it('should throw an error if the database query fails (getPendingByLecturer Catch)', async () => {
        // ARRANGE
        const lecturerId = 5002;
        const mockError = new Error('Network timeout.');
        
        // CRITICAL: Mock the top-level db.execute to fail
        db.execute.mockRejectedValueOnce(mockError);

        // ACT & ASSERT: Expect the function to throw the mocked error
        await expect(
            ScheduleModel.getPendingByLecturer(lecturerId)
        ).rejects.toThrow(mockError);
        
        // ASSERT (White-Box): Verify the function was called
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("FROM appointments a"),
            [lecturerId]
        );
    });

    it('should successfully create an appointment request and pivot entries in a single transaction (Black-Box)', async () => {
        // ARRANGE
        const newAppId = 55; // Mocked ID returned from the first INSERT
        const data = {
            studentId: 3001,
            startTime: '2026-04-10 10:00:00',
            endTime: '2026-04-10 11:00:00',
            location: 'Classroom C',
            mode: 'offline',
            notes: 'Discussion on Chapter 5.',
            lecturerIds: [5003, 5004] // Two lecturers
        };

        // Mock the three internal execute calls in order:
        // 1. INSERT appointments should return the new ID
        mockConnection.execute.mockResolvedValueOnce([{ insertId: newAppId }]);
        // 2. INSERT appointment_lecturers (first lecturer)
        mockConnection.execute.mockResolvedValueOnce([{}]); 
        // 3. INSERT appointment_lecturers (second lecturer)
        mockConnection.execute.mockResolvedValueOnce([{}]);

        // ACT
        const resultAppId = await ScheduleModel.createRequest(data);

        // ASSERT (Black-Box): Check the final returned ID
        expect(resultAppId).toBe(newAppId);
        
        // ASSERT (White-Box/Logic): Verify the first INSERT query (Call 1)
        expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO appointments"),
            [data.studentId, data.startTime, data.endTime, data.location, data.mode, data.notes]
        );

        // ASSERT (White-Box/Logic): Verify the pivot inserts happened for BOTH lecturers (Calls 2 & 3)
        // CRITICAL FIX: Only expect two parameters ([app_id, lecturer_id])
        expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO appointment_lecturers"),
            [newAppId, 5003]
        );
        expect(mockConnection.execute).toHaveBeenCalledWith(
            expect.stringContaining("INSERT INTO appointment_lecturers"),
            [newAppId, 5004]
        );
        
        // Total execute calls: 1 (appointments) + 2 (pivot) = 3
        expect(mockConnection.execute).toHaveBeenCalledTimes(3); 
        expect(mockConnection.commit).toHaveBeenCalledTimes(1);
    });

    it('should rollback the entire transaction if a lecturer pivot insert fails (White-Box Rollback)', async () => {
        // ARRANGE
        const newAppId = 56;
        const data = {
            studentId: 3002,
            startTime: '2026-04-11 10:00:00',
            // other required data...
            lecturerIds: [5005, 5006] // Two lecturers
        };
        const mockError = new Error('Pivot table insertion error.');

        // 1. INSERT appointments succeeds and returns ID
        mockConnection.execute.mockResolvedValueOnce([{ insertId: newAppId }]);
        // 2. The next execute call (first lecturer pivot) FAILS
        mockConnection.execute.mockRejectedValueOnce(mockError);

        // ACT & ASSERT: Expect the function to throw the mocked error
        await expect(
            ScheduleModel.createRequest(data)
        ).rejects.toThrow(mockError);

        // ASSERT (White-Box Structure): Check transaction flow cleanup
        expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    // Test Case N: Successful Retrieval (getById)
    it('should retrieve a single appointment by its ID', async () => {
        // ARRANGE
        const appId = 77;
        // Mock the expected database result, including aggregation columns
        const mockRow = { 
            id: 77, 
            topic: 'Final Review', 
            student_id: 101, 
            lecturers: 'Dr. Smith',
            start_time: '2026-01-01 09:00:00'
        };
        
        // Mock the top-level db.execute to return a single row result set
        db.execute.mockResolvedValueOnce([[mockRow]]);

        // ACT
        const result = await ScheduleModel.getById(appId);

        // ASSERT (Black-Box): Check the result
        expect(result).toEqual(mockRow);
        
        // ASSERT (White-Box): Verify the correct query and parameters were executed
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("WHERE a.app_id = ?"),
            [appId]
        );
    });

    // Test Case O: Successful Retrieval (getByLecturerId)
    it('should retrieve all appointments for a specific lecturer', async () => {
        // ARRANGE
        const lecturerId = 6001;
        
        const mockDbResult = [
            { id: 100, topic: 'Thesis Defense', status: 'approved', student_name: 'Adam', npm: '111' },
            { id: 101, topic: 'Proposal', status: 'rejected', student_name: 'Budi', npm: '222' }
        ];
        
        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getByLecturerId(lecturerId);

        // ASSERT (Black-Box): Check data content and structure
        expect(result).toEqual(mockDbResult);
        expect(result.length).toBe(2);
        
        // ASSERT (White-Box): Verify the correct query and parameters were executed
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("WHERE al.lecturer_id = ?"),
            [lecturerId]
        );
    });

    // Test Case P: Error Handling (getById Catch)
    it('should throw an error if the database query fails (getById Catch)', async () => {
        // ARRANGE
        const appId = 78;
        const mockError = new Error('Database connection failed for getById.');
        
        db.execute.mockRejectedValueOnce(mockError);

        // ACT & ASSERT: Expect the function to throw the mocked error
        await expect(
            ScheduleModel.getById(appId)
        ).rejects.toThrow(mockError);
        
        // ASSERT (White-Box): Verify the function was called
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("WHERE a.app_id = ?"),
            [appId]
        );
    });

    //Test Case Q: getStudentClassSchedule (Black-Box)
    it('should retrieve student fixed class schedule for a specific day', async () => {
        // ARRANGE
        const studentId = 300;
        const day = 'Monday';
        const mockDbResult = [
            { start_time: '08:00:00', end_time: '10:00:00' },
            { start_time: '14:00:00', end_time: '16:00:00' }
        ];

        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getStudentClassSchedule(studentId, day);

        // ASSERT (Black-Box)
        expect(result).toEqual(mockDbResult);
        
        // ASSERT (White-Box)
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("FROM student_schedules"),
            [studentId, day]
        );
    });

    //Test Case R: getLecturerBusySchedules (Black-Box)
    it('should retrieve lecturer fixed class schedules for a specific day', async () => {
        // ARRANGE
        const lecturerId = 700;
        const day = 'Tuesday';
        const mockDbResult = [
            { start_time: '10:00:00', end_time: '12:00:00' }
        ];

        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getLecturerBusySchedules(lecturerId, day);

        // ASSERT (Black-Box)
        expect(result).toEqual(mockDbResult);
        
        // ASSERT (White-Box)
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("FROM lecturer_schedules"),
            [lecturerId, day]
        );
    });

    //Test Case S: getExistingAppointments (Black-Box - Lecturer Path)
    it('should retrieve existing appointments for a lecturer on a specific date', async () => {
        // ARRANGE
        const userId = 800;
        const userType = 'lecturer';
        const date = '2026-10-25';
        const mockDbResult = [
            { start_time: '11:00:00', end_time: '12:00:00' }
        ];

        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getExistingAppointments(userId, userType, date);

        // ASSERT (Black-Box)
        expect(result).toEqual(mockDbResult);
        
        // ASSERT (White-Box): Check for the query structure used for lecturers (JOIN)
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("JOIN appointment_lecturers al ON a.app_id = al.app_id"),
            [userId, date]
        );
    });

    //Test Case T: getExistingAppointments (Black-Box - Student Path)
    it('should retrieve existing appointments for a student on a specific date (Student Path)', async () => {
        // ARRANGE
        const userId = 801;
        const userType = 'student';
        const date = '2026-10-26';
        const mockDbResult = [
            { start_time: '09:00:00', end_time: '10:00:00' }
        ];

        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getExistingAppointments(userId, userType, date);

        // ASSERT (Black-Box)
        expect(result).toEqual(mockDbResult);
        
        // ASSERT (White-Box): Check for the query structure used for students (no join)
        expect(db.execute).toHaveBeenCalledWith(
            // Check that the query explicitly mentions student_id
            expect.stringContaining("WHERE student_id = ?"),
            [userId, date]
        );
        // Ensure it did *not* use the lecturer join query
        expect(db.execute).not.toHaveBeenCalledWith(
            expect.stringContaining("JOIN appointment_lecturers al"),
            expect.anything()
        );
    });

    //Test Case U: getSupervisorsByStudentId (Black-Box)
    it('should retrieve all supervisors linked to a student by their ID', async () => {
        // ARRANGE
        const studentId = 900;
        const mockDbResult = [
            { id: 9001, name: 'Dr. John Doe' },
            { id: 9002, name: 'Prof. Jane Smith' }
        ];

        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getSupervisorsByStudentId(studentId);

        // ASSERT (Black-Box)
        expect(result).toEqual(mockDbResult);
        
        // ASSERT (White-Box): Check for the thesis join
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("FROM thesis t"),
            [studentId]
        );
    });

    //Test Case V: Error Handling for a Read Function (getStudentClassSchedule Catch)
    it('should throw an error if the database query fails (getStudentClassSchedule Catch)', async () => {
        // ARRANGE
        const studentId = 301;
        const day = 'Friday';
        const mockError = new Error('Database connection failed for class schedule.');
        
        db.execute.mockRejectedValueOnce(mockError);

        // ACT & ASSERT: Expect the function to throw the mocked error
        await expect(
            ScheduleModel.getStudentClassSchedule(studentId, day)
        ).rejects.toThrow(mockError);
    });

    //Test Case W: updateLecturerResponse (Black-Box)
    it('should update only the individual lecturer response status in pivot table', async () => {
        // ARRANGE
        const appId = 10;
        const lecturerId = 500;
        const status = 'accepted';

        // ACT
        await ScheduleModel.updateLecturerResponse(appId, lecturerId, status);

        // ASSERT (White-Box): Verify the exact query and parameters
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE appointment_lecturers"),
            [status, appId, lecturerId]
        );
    });

    //Test Case Y: Error Handling for a Transaction (replaceStudentSchedule Catch)
    it('should rollback transaction if semester ID retrieval fails in replaceStudentSchedule', async () => {
        // ARRANGE
        const studentId = 400;
        const schedules = [{ day: 'Monday', start: '08:00', end: '10:00', course: 'RPL' }];
        const mockError = new Error('Semester lookup error.');
        
        // Mock the DELETE to pass, but the SELECT (for semester) to fail
        mockConnection.execute.mockResolvedValueOnce([{}]);
        mockConnection.execute.mockRejectedValueOnce(mockError);

        // ACT & ASSERT: Expect the function to throw the mocked error
        await expect(
            ScheduleModel.replaceStudentSchedule(studentId, schedules)
        ).rejects.toThrow(mockError);

        // ASSERT (White-Box Structure): Check transaction flow cleanup
        expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    //Test Case Z: Error Handling for a Transaction (updateStatus Catch)
    it('should rollback transaction if a query fails in updateStatus (Catch Coverage)', async () => {
        // ARRANGE
        const appId = 99;
        const status = 'approved';
        const lecturerId = 999;
        const mockError = new Error('Update query failed.');
        
        // Mock the first execute (UPDATE appointments) to fail
        mockConnection.execute.mockRejectedValueOnce(mockError);

        // ACT & ASSERT: Expect the function to throw the mocked error
        await expect(
            ScheduleModel.updateStatus(appId, status, null, lecturerId)
        ).rejects.toThrow(mockError);

        // ASSERT (White-Box Structure): Check transaction flow cleanup
        expect(mockConnection.beginTransaction).toHaveBeenCalledTimes(1);
        expect(mockConnection.rollback).toHaveBeenCalledTimes(1);
        expect(mockConnection.commit).not.toHaveBeenCalled();
    });

    //Test Case AA: getAppointmentResponses (Black-Box)
    it('should retrieve all lecturer response statuses for an appointment', async () => {
        // ARRANGE
        const appId = 30;
        const mockDbResult = [
            { response_status: 'accepted' },
            { response_status: 'pending' },
            { response_status: 'rejected' }
        ];

        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getAppointmentResponses(appId);

        // ASSERT (Black-Box)
        expect(result).toEqual(mockDbResult);
        
        // ASSERT (White-Box)
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("FROM appointment_lecturers"),
            [appId]
        );
    });

    //Test Case BB: getLecturerIdsByAppId (Black-Box)
    it('should retrieve a list of all lecturer IDs linked to an appointment', async () => {
        // ARRANGE
        const appId = 40;
        const mockDbResult = [
            { lecturer_id: 5001 },
            { lecturer_id: 5002 }
        ];

        db.execute.mockResolvedValueOnce([mockDbResult]);

        // ACT
        const result = await ScheduleModel.getLecturerIdsByAppId(appId);

        // ASSERT (Black-Box): Check that the result is correctly mapped
        expect(result).toEqual([5001, 5002]);
        
        // ASSERT (White-Box)
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("FROM appointment_lecturers WHERE app_id = ?"),
            [appId]
        );
    });

    //Test Case CC: updateGlobalStatus (Black-Box - Approval Path)
    it('should update the global status using the simple query for approval', async () => {
        // ARRANGE
        const appId = 21;
        const finalStatus = 'approved';
        // Note: notes is null, so it should trigger the simple query path

        // ACT
        await ScheduleModel.updateGlobalStatus(appId, finalStatus, null);

        // ASSERT (White-Box): Verify the simple update query is used (no CONCAT/notes logic)
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE appointments SET status = ? WHERE app_id = ?"),
            [finalStatus, appId]
        );
        // Ensure the complex rejection query was NOT used
        expect(db.execute).not.toHaveBeenCalledWith(
            expect.stringContaining("notes = CONCAT("),
            expect.anything()
        );
    });

    //Test Case DD: updateGlobalStatus (White-Box - Rejected without Notes)
    it('should use simple query if status is rejected but notes are null (Final Branch Coverage)', async () => {
        // ARRANGE
        const appId = 22;
        const finalStatus = 'rejected';
        const notes = null; // Key condition: notes is null

        // ACT
        await ScheduleModel.updateGlobalStatus(appId, finalStatus, notes);

        // ASSERT (White-Box): Verify the simple update query is used (same as 'approved' path)
        expect(db.execute).toHaveBeenCalledWith(
            expect.stringContaining("UPDATE appointments SET status = ? WHERE app_id = ?"),
            [finalStatus, appId]
        );
        // Ensure the complex rejection query was NOT used
        expect(db.execute).not.toHaveBeenCalledWith(
            expect.stringContaining("notes = CONCAT("),
            expect.anything()
        );
    });


});