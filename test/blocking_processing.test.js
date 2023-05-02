const {processBlockingData} = require("../logic/blocking.cjs");

// Mock Date.now to return a fixed date (2023-05-03 12:59:59 AM GMT)
Date.now = jest.fn(() => 1683075599000)

describe('Test blocking processing', function () {
    it('Test process', function () {
        const data = [
            {
                id: 1,
                type: 'old',
                path: '123456789',
                end_date: null,
            },
            {
                id: 2,
                type: 'old',
                path: '987654321',
                end_date: new Date(2023, 4, 2, 0, 0, 0, 0),
            }
        ];
        const processed = processBlockingData(data);
        expect(processed.length).toBe(2);
        expect(processed[0]).toMatchObject({
            "blocked": true,
            "endDate": null,
            "id": 1,
            "path": "123456789",
            "type": "old",
        });
        expect(processed[1]).toMatchObject({
            "blocked": false,
            "endDate": new Date(2023, 4, 2, 0, 0, 0, 0),
            "id": 2,
            "path": "987654321",
            "type": "old",
        });
    });
});