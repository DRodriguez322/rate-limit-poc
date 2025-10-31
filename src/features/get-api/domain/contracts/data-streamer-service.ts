export abstract class GetApiServiceContract {
  abstract getApi(idPokemon?: number): Promise<any>;
}
