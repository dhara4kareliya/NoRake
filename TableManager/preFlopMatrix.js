const fs = require('fs')
var preFlopMatrixData = [];

async function readMatrixCsvFile() {
    // var data = await fs.readFile("./matrix.csv",'utf8');
    var matrix = {};
    var data = await fs.readFileSync("./matrix.csv", 'utf8');
    const rows = data.split('\n');

    var header = rows[0].split(',');
    for (var i = 1; i < rows.length; i++) {
        const columns = rows[i].split(',');
        columns[0] = columns[0].toUpperCase();
        for (var j = 1; j < columns.length; j++) {
            if (columns[j] != '') {
                header[j] = header[j].toUpperCase();
                if (matrix[columns[0]] == undefined) {
                    matrix[columns[0]] = {};
                    matrix[columns[0]][header[j]] = columns[j];
                    continue;
                }

                matrix[columns[0]][header[j]] = columns[j].trim();
            }

        }
    }
    preFlopMatrixData = matrix;
};

function checkPlayersCard(players) {
    var playercards1 = players[0].playerCard.join(" ");
    var playercards2 = players[1].playerCard.join(" ");

    var rowData = preFlopMatrixData[playercards1];
    if (rowData == undefined) {
        playercards1 = players[0].playerCard.reverse().join(" ");
        rowData = preFlopMatrixData[playercards1];
    }

    var player1Result = rowData[playercards2];
    if (player1Result == undefined) {
        playercards2 = players[1].playerCard.reverse().join(" ");
        player1Result = rowData[playercards2];
    }
    players[1].result = player1Result;
    players[0].result = preFlopMatrixData[playercards2][playercards1];

    return players;
};
module.exports = { readMatrixCsvFile, checkPlayersCard };