import { ethers } from "hardhat";

async function main() {
  const RegistryFactory = await ethers.getContractFactory("Registry");
  const Registry = await RegistryFactory.attach("0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0");

  const IDPFactory = await ethers.getContractFactory("IDP");
  const IDP = await IDPFactory.attach(await Registry.idp());

  const names = [
      "Luftbrücke für die Ukraine",
      "TSG abschaffen",
      "Grundeinkommen",
      "Kreisverkehr kann Leben retten!",
      "Stoppt den Welpenhandel"
  ];
  const descriptions = [
      `Frau Baerbock, Herr Scholz, wir fordern für die bedrohten ukrainischen Städte und Dörfer eine zivile Luftbrücke mit Versorgungsgütern: Nahrungsmitteln, Wasser, Medikamente, Hygieneartikel und Kleidung. Das alles fehlt und ist für meine Familie und die Menschen in der Ukraine eine Frage von Leben und Tod.`,
      `Ich bin Emma, 17 Jahre alt und selbst trans. Nachdem die Große Koalition ihren eigenen Koalitionsvertrag gebrochen hat und der Bundestag kein neues Selbstbestimmungsgesetz auf den Weg gebracht hat, fordere ich nun von der neuen Bundesregierung die Abschaffung des Transsexuellengesetzes. Wir brauchen ein Selbstbestimmungsgesetz. Und das noch dieses Jahr. Ich fordere #Selbstbestimmung2022!`,
      `Wir fordern, dass die Politik endlich ihrer zentralen Aufgabe nachkommt und wegweisende, zukunftsgerichtete Strukturen aufsetzt. Angesichts des aufgeblähten Niedriglohnsektors, einer unerwarteten Corona-Krise, unfassbar ineffizientem Bürokratiedickicht, lebensbedrohlichem Klimawandel und der Vermögensschere, die immer weiter auseinander klafft, gibt es für uns nur ein Instrument: das Bedingungslose Grundeinkommen!`,
      `Daher fordern wir die Errichtung eines Kreisverkehrs an der Kreuzung B516 und K8! Das Schicksal von Antonia darf sich nicht wiederholen. Das Land NRW und der Verkehrsminister Hendrik Wüst sollen endlich handeln und zeigen, dass sie aus diesem schrecklichen Vorfall gelernt haben.`,
      `Der illegale Welpenhandel boomt seit der Corona-Pandemie wie nie zuvor. Die Fakten rund um das hoch lukrative Geschäft mit viel zu jungen Hundebabys, die unter tierschutzwidrigsten Bedingungen in osteuropäischen Vermehrer-Stationen gezüchtet werden, sind weitläufig bekannt. Es ist höchste Zeit diesen illegalen Welpenhandel zu stoppen!`
  ];
  const ids = [
      "0x0000000000000000000000000000000000000000000000000000000000000000",
      "0x0000000000000000000000000000000000000000000000000000000000000001",
      "0x0000000000000000000000000000000000000000000000000000000000000002",
      "0x0000000000000000000000000000000000000000000000000000000000000003",
      "0x10000000000000000000000000000000000000000000000000000000000000F0"
  ];
  const baseperiod = (await IDP.period()).toNumber();
  const periods = [
      baseperiod,
      baseperiod,
      0,
      baseperiod + 2,
      baseperiod + 3
  ];

  const petition_promises: Promise<any>[] = [];
  const submittable_names = names
    .map((name) => ethers.utils.zeroPad(ethers.utils.toUtf8Bytes(name), 32));
  for(let i = 0; i < names.length; i++) {
    await Registry.createPetition(submittable_names[i], descriptions[i], periods[i]);
    console.log(`Petition ${names[i]} added`)
  }
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
