import {
  LogService,
  PageDataType,
  UseCaseInterface,
  PaisInvalidoError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class ExcluirPaisUseCase implements UseCaseInterface {
  private _tabelaPaises: string;
  private _tabelaAutores: string;
  private logService = new LogService('ExcluirPaisUseCase');

  constructor(private _repository: RepositoryInterface) {
    this._tabelaPaises = process.env.TABELA_PAISES || 'Paises';
    this._tabelaAutores = process.env.TABELA_AUTORES || 'Autores';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info('🏁 Iniciando caso de uso de excluir país.');
    const paisId = data.queryStringParameters?.id;
    if (!paisId) {
      this.logService.warn('ID do país não fornecido.');
      // TODO: Necessário implementação de "PaisInvalidaError" no core-layer para tratar casos de exclusão de país com autores associados.,
      // throw new PaisInvalidaError('ID do país é obrigatório para exclusão.');
      throw new PaisInvalidoError('ID do país é obrigatório para exclusão.');
    }
    const autoresDoPais = await this._repository.getAll(this._tabelaAutores, {
      filterKey: 'paisId',
      filterValue: data.queryStringParameters?.id ?? '',
    });
    if (autoresDoPais?.data && autoresDoPais?.data.length > 0) {
      this.logService.warn(
        `Não é possível excluir o país ${paisId} porque existem autores associados a ele.`
      );
      // throw new PaisInvalidaError('Não é possível excluir o país porque existem autores associados a ele.');
      throw new PaisInvalidoError(
        'Não é possível excluir o país porque existem autores associados a ele.'
      );
    }

    try {
      const result = await this._repository.deleteByMinhotecaId(
        this._tabelaPaises,
        data.queryStringParameters?.id ?? ''
      );
      return createResult(result.data, 200, 'País excluído com sucesso.');
    } catch (error) {
      this.logService.error('Erro ao excluir país:', { data }, error as Error);
      throw new PaisInvalidoError('Falha ao excluir país.');
    }
  }
}
