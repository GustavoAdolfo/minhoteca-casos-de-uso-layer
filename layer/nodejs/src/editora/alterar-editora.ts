import {
  EditoraDTO,
  EditoraAdapter,
  UseCaseInterface,
  PageDataType,
  LogService,
  EditoraInvalidaError,
} from '@gustavoadolfo/minhoteca-core-layer';
import { RepositoryInterface } from '@gustavoadolfo/minhoteca-adapter-layer';
import { APIGatewayEvent } from 'aws-lambda';
import { createResult } from '../util';

export class AlterarEditoraUseCase implements UseCaseInterface {
  private _tabelaEditoras: string;
  private logService = new LogService('AlterarEditoraUseCase');

  constructor(
    private _repository: RepositoryInterface,
    private idExecucao?: string
  ) {
    this._tabelaEditoras = process.env.TABELA_EDITORAS ?? 'Editoras';
  }

  async execute(data: APIGatewayEvent): Promise<PageDataType> {
    this.logService.info(
      'Início a execução do caso de uso AlterarEditoraUseCase',
      { label: 'AlterarEditoraUseCase', logId: this.idExecucao },
      { data }
    );
    try {
      const dto = JSON.parse(data.body ?? '{}') as EditoraDTO;
      if (!dto.id || dto.id.trim() === '') {
        this.logService.error(
          'ID da editora é obrigatório para alteração.',
          { label: 'AlterarEditoraUseCase', logId: this.idExecucao },
          undefined,
          { dto }
        );
        throw new EditoraInvalidaError('ID da editora é obrigatório para alteração.');
      }

      const entity = EditoraAdapter.fromCreateDTO(dto);

      const result = await this._repository.updateByMinhotecaId(
        this._tabelaEditoras,
        JSON.parse(entity.toJSONString()),
        dto.id
      );

      return createResult(result.data, 200, 'Editora alterada com sucesso');
    } catch (error) {
      this.logService.error(
        'Erro ao alterar editora:',
        { label: 'AlterarEditoraUseCase', logId: this.idExecucao },
        error as Error,
        { data }
      );
      throw new EditoraInvalidaError('Falha ao alterar editora.');
    }
  }
}
