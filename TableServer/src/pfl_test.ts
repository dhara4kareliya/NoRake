import { PFLogic, Result } from "./poker/pfl";

function dump(message: string, list: Result[]) {
    console.log(`--${message}--------`);

    console.table(list.map(res => {
        const data: any = {
            index: res.sitIndex,
        };
        (!res.emptySit) && (data.player = '*');
        res.sitOut && (data.sitOut = 'S');
        const buttons = [];
        res.isD && (buttons.push('D'));
        res.isSB && (buttons.push('SB'));
        res.isBB && (buttons.push('BB'));
        buttons.length && (data.buttons = buttons.join(','));
        data.sum = res.sum;
        const posts = [];
        res.missBB && (posts.push('MissBB'));
        res.missSB && (posts.push('MissSB'));
        res.sbAnte && (posts.push('SBAnte'));
        posts.length && (data.posts = posts.join(','));
        return data;
    }));
    console.log(`----------`);
}

function test1() {

    const pfl = new PFLogic();
    pfl.addPlayer(1, false);
    pfl.addPlayer(3, false);
    pfl.addPlayer(4, false);
    pfl.addPlayer(6, false);
    pfl.addPlayer(7, false);

    // first round
    let list = pfl.run(10, 5, false);
    dump(`round#1`, list);

    pfl.playerLeaves(4);
    pfl.playerLeaves(7);

    // second round
    list = pfl.run(10, 5, false);
    dump(`round#2`, list);
}

function test2() {

    const pfl = new PFLogic();
    pfl.addPlayer(1, false);
    pfl.addPlayer(3, false);
    pfl.addPlayer(4, false);
    pfl.addPlayer(6, false);
    pfl.addPlayer(7, false);

    // first round
    let list = pfl.run(10, 5, false);
    dump(`round#1`, list);

    pfl.playerLeaves(3);

    // second round
    list = pfl.run(10, 5, false);
    dump(`round#2`, list);
}

function test3() {

    const pfl = new PFLogic();
    pfl.addPlayer(1, false);
    pfl.addPlayer(3, false);
    pfl.addPlayer(4, false);
    pfl.addPlayer(6, false);
    pfl.addPlayer(7, false);

    // first round
    let list = pfl.run(10, 5, false);
    dump(`round#1`, list);

    // second round
    if (pfl.canjoinNow(0, false, false)) {
        console.log(`Adding player in seat#0`);
        pfl.addPlayer(0, false);
    }
    list = pfl.run(10, 5, false);
    dump(`round#2`, list);

    // third round
    list = pfl.run(10, 5, false);
    dump(`round#3`, list);
}

(function main() {
    //test1();
    //test2();
    test3();
}());
