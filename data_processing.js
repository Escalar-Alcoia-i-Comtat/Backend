module.exports = {
    processDataClassQuery: (query) => {
        let items = {};
        for (let i in query)
            if (query.hasOwnProperty(i) && query[i].objectId != null) {
                const item = query[i];
                const objectId = item.objectId.toString();
                delete item["objectId"];

                if (item.hasOwnProperty('area'))
                    item['area'] = item.area.toString();
                if (item.hasOwnProperty('zone'))
                    item['zone'] = item.zone.toString();
                if (item.hasOwnProperty('sector'))
                    item['sector'] = item.sector.toString();

                // Sector adjustments
                if (item.hasOwnProperty('kidsApt'))
                    item['kidsApt'] = item.kidsApt === '1';

                // Path adjustments
                if (item.hasOwnProperty('crackerRequired'))
                    item['crackerRequired'] = item.crackerRequired === '1';
                if (item.hasOwnProperty('friendRequired'))
                    item['friendRequired'] = item.friendRequired === '1';
                if (item.hasOwnProperty('lanyardRequired'))
                    item['lanyardRequired'] = item.lanyardRequired === '1';
                if (item.hasOwnProperty('nailRequired'))
                    item['nailRequired'] = item.nailRequired === '1';
                if (item.hasOwnProperty('pitonRequired'))
                    item['pitonRequired'] = item.pitonRequired === '1';
                if (item.hasOwnProperty('stripsRequired'))
                    item['stripsRequired'] = item.stripsRequired === '1';

                items[objectId] = item;
            }
        return items;
    }
};