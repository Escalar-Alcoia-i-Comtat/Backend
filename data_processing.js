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

                if (item.hasOwnProperty('kidsApt'))
                    item['kidsApt'] = item.kidsApt === '1';

                items[objectId] = item;
            }
        return items;
    }
};